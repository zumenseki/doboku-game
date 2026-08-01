import { createFileRoute } from '@tanstack/react-router'

// GET    /api/admin/site?id= → { site, reportCount, photoCount, paints, assignments }
// PATCH  /api/admin/site {id, action: 'update'|'close'|'reopen'|'reissue'|'scale', ...}
// DELETE /api/admin/site?id=&confirm=<現場名> → 現場を完全削除 (日報・写真・図面もろとも)
export const Route = createFileRoute('/api/admin/site')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const id = new URL(request.url).searchParams.get('id') ?? ''
        const db = core.requireDB()
        const site = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first()
        if (!site) return core.json({ message: '現場が見つかりません' }, 404)

        const [count, photoCount, paints, assignments] = await Promise.all([
          db.prepare('SELECT COUNT(*) AS n FROM reports WHERE site_id = ?').bind(id).first<{ n: number }>(),
          db
            .prepare(
              `SELECT COUNT(*) AS n FROM report_photos p
               JOIN reports r ON r.id = p.report_id WHERE r.site_id = ?`,
            )
            .bind(id)
            .first<{ n: number }>(),
          db
            .prepare(
              `SELECT pr.id, pr.polygon, pr.area_m2, r.work_date, COALESCE(b.name,'(不明)') AS sub_name
               FROM paint_regions pr
               JOIN reports r ON r.id = pr.report_id
               LEFT JOIN subs b ON b.id = r.sub_id
               WHERE r.site_id = ?
               ORDER BY r.work_date, r.created_at LIMIT 500`,
            )
            .bind(id)
            .all<{ id: string; polygon: string; area_m2: number; work_date: string; sub_name: string }>(),
          // この現場に割り当てられた業者（＝発行済みの日報URL）
          db
            .prepare(
              `SELECT ss.id, ss.token, b.id AS sub_id, b.name AS sub_name, b.is_active AS sub_active,
                      (SELECT COUNT(*) FROM reports r WHERE r.site_id = ss.site_id AND r.sub_id = ss.sub_id) AS report_count,
                      (SELECT MAX(r.work_date) FROM reports r WHERE r.site_id = ss.site_id AND r.sub_id = ss.sub_id) AS last_date
               FROM site_subs ss JOIN subs b ON b.id = ss.sub_id
               WHERE ss.site_id = ?
               ORDER BY b.display_order, b.name`,
            )
            .bind(id)
            .all(),
        ])

        const paintRows = (paints.results ?? []).flatMap((p) => {
          try {
            const meta = JSON.parse(p.polygon) as { objectKey?: string }
            if (!meta.objectKey) return []
            return [
              {
                id: p.id,
                objectKey: meta.objectKey,
                areaM2: p.area_m2,
                workDate: p.work_date,
                subName: p.sub_name,
              },
            ]
          } catch {
            return []
          }
        })

        return core.json({
          site,
          reportCount: count?.n ?? 0,
          photoCount: photoCount?.n ?? 0,
          paints: paintRows,
          assignments: assignments.results ?? [],
        })
      },
      PATCH: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const { siteSchema } = await import('../../../nippo/validation')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const body = (await core.readJson(request)) as Record<string, unknown> | null
        if (!body) return core.json({ message: 'リクエストが不正です' }, 400)
        const id = String(body.id ?? '')
        const action = String(body.action ?? '')
        const db = core.requireDB()

        if (action === 'update') {
          const areaRaw = body.totalAreaM2
          const parsed = siteSchema.safeParse({
            name: String(body.name ?? ''),
            address: String(body.address ?? '') || undefined,
            totalAreaM2:
              areaRaw === null || areaRaw === undefined || areaRaw === '' ? null : Number(areaRaw),
          })
          if (!parsed.success) {
            return core.json({ message: parsed.error.issues[0]?.message ?? '入力内容を確認してください' }, 400)
          }
          await db
            .prepare('UPDATE sites SET name = ?, address = ?, total_area_m2 = ? WHERE id = ?')
            .bind(parsed.data.name, parsed.data.address ?? null, parsed.data.totalAreaM2 ?? null, id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'scale') {
          const scale = Number(body.scaleMPerUnit)
          if (!Number.isFinite(scale) || scale <= 0 || scale > 100000) {
            return core.json({ message: '縮尺の値が不正です' }, 400)
          }
          await db.prepare('UPDATE sites SET scale_m_per_unit = ? WHERE id = ?').bind(scale, id).run()
          return core.json({ ok: true })
        }

        if (action === 'close') {
          await db
            .prepare("UPDATE sites SET status = 'closed', closed_at = ? WHERE id = ?")
            .bind(core.nowIso(), id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'reopen') {
          await db
            .prepare("UPDATE sites SET status = 'active', closed_at = NULL WHERE id = ?")
            .bind(id)
            .run()
          return core.json({ ok: true })
        }

        if (action === 'reissue') {
          const token = core.randomToken(21)
          await db.prepare('UPDATE sites SET token = ? WHERE id = ?').bind(token, id).run()
          return core.json({ ok: true, token })
        }

        return core.json({ message: '操作が不正です' }, 400)
      },
      DELETE: async ({ request }) => {
        const core = await import('../../../nippo/server/core.server')
        const denied = await core.requireAdmin(request)
        if (denied) return denied

        const url = new URL(request.url)
        const id = url.searchParams.get('id') ?? ''
        const confirm = (url.searchParams.get('confirm') ?? '').trim()
        const db = core.requireDB()

        const site = await db
          .prepare('SELECT id, name, drawing_key, drawing_image_key FROM sites WHERE id = ?')
          .bind(id)
          .first<{ id: string; name: string; drawing_key: string | null; drawing_image_key: string | null }>()
        if (!site) return core.json({ message: '現場が見つかりません' }, 404)

        // 取り違え防止。現場名を一字一句入力してもらってはじめて削除する。
        if (confirm !== site.name) {
          return core.json({ message: '現場名が一致しません。表示どおりに入力してください' }, 400)
        }

        // ---- R2から消すファイルを集める ----
        const keys = new Set<string>()
        if (site.drawing_key) keys.add(site.drawing_key)
        if (site.drawing_image_key) keys.add(site.drawing_image_key)

        const photos = await db
          .prepare(
            `SELECT p.object_key AS k FROM report_photos p
             JOIN reports r ON r.id = p.report_id WHERE r.site_id = ?`,
          )
          .bind(id)
          .all<{ k: string }>()
        for (const row of photos.results ?? []) keys.add(row.k)

        const masks = await db
          .prepare(
            `SELECT pr.polygon AS j FROM paint_regions pr
             JOIN reports r ON r.id = pr.report_id WHERE r.site_id = ?`,
          )
          .bind(id)
          .all<{ j: string }>()
        for (const row of masks.results ?? []) {
          try {
            const meta = JSON.parse(row.j) as { objectKey?: string }
            if (meta.objectKey) keys.add(meta.objectKey)
          } catch {
            /* 壊れた行は無視。下のプレフィックス走査で拾える */
          }
        }

        // 取りこぼした色塗りマスクも prefix でまとめて拾う
        const r2 = core.requireR2()
        try {
          let cursor: string | undefined
          do {
            const listed = await r2.list({ prefix: `paintmasks/${id}/`, cursor, limit: 1000 })
            for (const o of listed.objects) keys.add(o.key)
            cursor = listed.truncated ? listed.cursor : undefined
          } while (cursor)
        } catch {
          /* listが使えなくてもDB由来のキーは消せるので続行 */
        }

        // ---- R2削除 (失敗しても行削除は進める。孤児ファイルは自動整理の対象) ----
        const keyList = [...keys]
        let filesDeleted = 0
        for (let i = 0; i < keyList.length; i += 500) {
          const chunk = keyList.slice(i, i + 500)
          try {
            await r2.delete(chunk)
            filesDeleted += chunk.length
          } catch {
            /* noop */
          }
        }

        // ---- D1削除 (子テーブルから順に) ----
        await db
          .prepare('DELETE FROM paint_regions WHERE report_id IN (SELECT id FROM reports WHERE site_id = ?)')
          .bind(id)
          .run()
        await db
          .prepare('DELETE FROM report_photos WHERE report_id IN (SELECT id FROM reports WHERE site_id = ?)')
          .bind(id)
          .run()
        await db.prepare('DELETE FROM reports WHERE site_id = ?').bind(id).run()
        await db.prepare('DELETE FROM site_subs WHERE site_id = ?').bind(id).run()
        await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run()

        return core.json({ ok: true, name: site.name, filesDeleted })
      },
    },
  },
})
