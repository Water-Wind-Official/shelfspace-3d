# ShelfSpace 3D

A working team template for the Hearthstone Collection Museum capstone. The 3D view uses **Three.js through React Three Fiber**. The page, forms, and shared records use TypeScript.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000/shelf-space-3d. A fresh browser starts with an example room, two shelves, and four sample items. You can edit those records or create your own rooms.

## What works

- Create rooms and shelves/display cases, with levels and positions.
- See shelves and item shapes in 3D; rotate, zoom, and reset the camera.
- Select an item in the scene or list, then edit its name, type, description, or location.
- Move items between rooms, shelves, levels, and positions using the item form. One item fits in each position.
- Search across all rooms, and remove items or empty shelves/rooms.
- Reopen the saved collection in the same browser. Older `shelfspace-items` records are read and migrated without discarding their names or locations.

The template stores records in browser `localStorage`. Cloudflare D1, barcode scanning, and external metadata lookup are the next team integrations. There are no simulated scan or database buttons.

## Where each teammate can work

| File | Purpose |
| --- | --- |
| `src/app/shelf-space-3d/page.tsx` | The page's state and actions; connects forms to the scene and saving. |
| `src/components/shelf-space/Scene.tsx` | Three.js shelves, item shapes, materials, camera, and click selection. Extend this for textures or dragging. |
| `src/components/shelf-space/ItemForm.tsx` | Manual item entry and editing. Barcode results can fill these same fields later. |
| `src/lib/shelfspace-types.ts` | Shared room, shelf, and item record shapes. Agree on these before changing the database schema. |
| `src/lib/shelfspace-data.ts` | Example data, validation, old-list migration, saving/loading, and finding empty positions. |
| `src/app/shelf-space-3d/organizer.css` | Basic responsive workspace styling. |

Stored item `level` and `slot` start at **0**. The interface displays them starting at **1**. A shelf belongs to a room; an item belongs to a shelf. Its room is found through that shelf, so moving an item does not leave conflicting room information.

For the database integration, replace `loadOrganizer` / `saveOrganizer` calls in the page with asynchronous API calls. Keep the record fields and validation consistent. For dragging, calculate a destination level/slot, check occupancy, and update the same item record used by the form.

## Checks

```bash
npx tsc --noEmit --incremental false
npm run build
```

A useful manual check is: create a room → create a shelf → add an item → select it → move it → refresh → search for it → remove it. Also try filling a one-position shelf; the form should prevent a second item using that position.

## Existing Cloudflare deployment

This repository retains its Next.js/OpenNext Cloudflare configuration. Once the team is ready to publish through its existing Cloudflare project:

```bash
npm run deploy
```
