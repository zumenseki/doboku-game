import { createFileRoute } from '@tanstack/react-router'

// POST /api/rreport (JSON) — 日報 + 写真キーの登録。
// 同一tokenへのPOSTは毎分10回に制限。同一reportIdの再送は冪等に成功扱い。
export const Route = createFileRoute('/api/rreport')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const core = await import('../../nippo/server/core.server')
        const { reportSchema } = await import('../../nippo/validation')

        const body = await core.readJson(request)
        if (body === null) return core.json({ message: 'リクエストが不正です' }, 400)

        const parsed = reportSchema.safeParse(body)
        if (!parsed.success) {
          return core.json(
            { message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' },
            400,
          )
        }
        const input = parsed.data

        if (!core.rateLimit(`rreport:${input.token}`, 10)) {
          return core.json({ message: '送信が多すぎます。1分ほど待ってから再送してください' }, 429)
        }

        if (input.objectKeys.some((key) => !core.isPhotoKeyOf(key, input.reportId.toLowerCase()))) {
          return core.json({ message: '写真の指定が不正です' }, 400)
        }

        try {
          const result = await core.resolveSiteByToken(input.token)
          if (!result.ok) return core.json({ message: result.message }, result.status)
          const db = core.requireDB()

          // 色塗りマスクは「この現場×この日報」のキーのみ受け付ける
          if (
            input.paintRegion &&
            input.paintRegion.objectKey !== core.maskKeyFor(result.site.id, input.reportId.toLowerCase())
          ) {
            return core.json({ message: '色塗りデータの指定が不正です' }, 400)
          }

          const existing = await db
            .prepare('SELECT id FROM reports WHERE id = ?')
            .bind(input.reportId)
            .first()
          if (existing) {
            // ネットワーク断後のリトライ。成功済みとして扱う
            return core.json({ id: input.reportId, alreadySubmitted: true })
          }

          const sub = await db
            .prepare('SELECT id FROM subs WHERE id = ? AND is_active = 1')
            .bind(input.subId)
            .first()
          if (!sub) return core.json({ message: '業者の選択が不正です' }, 400)

          const now = core.nowIso()
          const statements = [
            db
              .prepare(
                'INSERT INTO reports (id, site_id, sub_id, work_date, workers, work_type, area_m2, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
              )
              .bind(
                input.reportId,
                result.site.id,
                input.subId,
                input.workDate,
                input.workers,
                input.workType,
                input.areaM2 ?? null,
                input.note && input.note.length > 0 ? input.note : null,
                now,
              ),
            ...input.objectKeys.map((key) =>
              db
                .prepare(
                  'INSERT INTO report_photos (id, report_id, object_key, created_at) VALUES (?,?,?,?)',
                )
                .bind(core.uuid(), input.reportId, key, now),
            ),
            ...(input.paintRegion
              ? [
                  db
                    .prepare(
                      'INSERT INTO paint_regions (id, report_id, page, polygon, area_m2) VALUES (?,?,1,?,?)',
                    )
                    .bind(
                      core.uuid(),
                      input.reportId,
                      JSON.stringify({
                        kind: 'mask',
                        objectKey: input.paintRegion.objectKey,
                        width: input.paintRegion.width,
                        height: input.paintRegion.height,
                      }),
                      input.paintRegion.areaM2,
                    ),
                ]
              : []),
          ]
          // D1のbatchはトランザクションとして実行される
          await db.batch(statements)

          return core.json({ id: input.reportId })
        } catch (e) {
          console.error('rreport failed', e)
          return core.json({ message: '日報の保存に失敗しました' }, 500)
        }
      },
    },
  },
})
