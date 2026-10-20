"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import ItemForm from "@/components/shelf-space/ItemForm";
import { createExampleData, loadOrganizer, saveOrganizer } from "@/lib/shelfspace-data";
import type { ItemDetails, OrganizerData, Shelf } from "@/lib/shelfspace-types";
import "./organizer.css";


// Three.js needs the browser. The rest of the page can load while it starts.
const Scene = dynamic(() => import("@/components/shelf-space/Scene"), {
    ssr: false,
    loading: () => <p className="ss-scene-message" role="status">Opening the 3D view...</p>,
});

const emptyData: OrganizerData = { rooms: [], shelves: [], items: [] };


export default function ShelfSpace3D() {

    // This is the shared collection. The scene and forms both read from it.
    const [data, setData] = useState<OrganizerData>(emptyData);
    const [loaded, setLoaded] = useState(false);
    const [roomId, setRoomId] = useState("");
    const [shelfId, setShelfId] = useState("");
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    const [roomName, setRoomName] = useState("");
    const [shelfName, setShelfName] = useState("");
    const [levels, setLevels] = useState(3);
    const [slots, setSlots] = useState(5);
    const [search, setSearch] = useState("");
    const [viewNumber, setViewNumber] = useState(0);
    const [formNumber, setFormNumber] = useState(0);

    const [error, setError] = useState("");
    const [storageError, setStorageError] = useState("");
    const [notice, setNotice] = useState("");


    useEffect(() => {
        try {
            const saved = loadOrganizer();
            setData(saved);
            setRoomId(saved.rooms[0]?.id ?? "");
            setShelfId(saved.shelves.find((shelf) => shelf.roomId === saved.rooms[0]?.id)?.id ?? "");
        } catch {
            setStorageError("The saved layout could not be opened. It has been left untouched. Creating a new room will start a new layout.");
        }
        setLoaded(true);
    }, []);


    function updateData(nextData: OrganizerData, message: string) {
        setData(nextData);
        setError("");
        setNotice(message);

        // Swap these storage functions for API calls when the database is ready.
        try {
            saveOrganizer(nextData);
            setStorageError("");
        } catch {
            setStorageError("Browser saving is unavailable. Your changes work in this page, but will be lost when you leave.");
        }
    }


    const room = data.rooms.find((entry) => entry.id === roomId);
    const roomShelves = data.shelves.filter((shelf) => shelf.roomId === roomId);
    const roomItems = data.items.filter((item) => roomShelves.some((shelf) => shelf.id === item.shelfId));
    const shelf = roomShelves.find((entry) => entry.id === shelfId);
    const selectedItem = data.items.find((item) => item.id === selectedItemId) ?? null;

    // Room names in the dropdown make it possible to move items between rooms.
    const formShelves = data.shelves.map((entry) => ({
        ...entry,
        name: `${data.rooms.find((entryRoom) => entryRoom.id === entry.roomId)?.name} / ${entry.name}`,
    }));


    function selectRoom(id: string) {
        setRoomId(id);
        setShelfId(data.shelves.find((entry) => entry.roomId === id)?.id ?? "");
        setSelectedItemId(null);
        setError("");
    }

    function selectShelf(id: string) {
        setShelfId(id);
        setSelectedItemId(null);
    }

    function selectItem(id: string | null) {
        setSelectedItemId(id);
        const item = data.items.find((entry) => entry.id === id);
        const itemShelf = data.shelves.find((entry) => entry.id === item?.shelfId);
        if (itemShelf) {
            setRoomId(itemShelf.roomId);
            setShelfId(itemShelf.id);
        }
    }


    function addRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = roomName.trim();
        if (!name) return setError("Give the room a name. Spaces alone don't count.");
        if (data.rooms.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
            return setError("That room name is already in use.");
        }

        const newRoom = { id: crypto.randomUUID(), name };
        updateData({ ...data, rooms: [...data.rooms, newRoom] }, `Created ${name}. Add a shelf next.`);
        setRoomId(newRoom.id);
        setShelfId("");
        setSelectedItemId(null);
        setRoomName("");
    }


    function addShelf(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!room) return setError("Create or select a room first.");
        const name = shelfName.trim();
        if (!name) return setError("Give the shelf a name. Spaces alone don't count.");
        if (roomShelves.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
            return setError("That shelf name is already in this room.");
        }
        if (!Number.isInteger(levels) || levels < 1 || levels > 6 || !Number.isInteger(slots) || slots < 1 || slots > 8) {
            return setError("Use 1 to 6 levels and 1 to 8 positions per level.");
        }

        const newShelf: Shelf = { id: crypto.randomUUID(), roomId, name, levels, slots };
        updateData({ ...data, shelves: [...data.shelves, newShelf] }, `Created ${name}.`);
        setShelfId(newShelf.id);
        setSelectedItemId(null);
        setShelfName("");
    }


    function saveItem(details: ItemDetails): string | null {
        const destination = data.shelves.find((entry) => entry.id === details.shelfId);
        if (!details.name.trim()) return "Enter an item name. Spaces alone don't count.";
        if (!destination) return "Choose a shelf first.";
        if (!Number.isInteger(details.level) || details.level < 0 || details.level >= destination.levels ||
            !Number.isInteger(details.slot) || details.slot < 0 || details.slot >= destination.slots) {
            return "Choose a level and position inside this shelf.";
        }

        // One item per position keeps the first version easy to arrange.
        const occupied = data.items.some((item) => item.id !== selectedItemId &&
            item.shelfId === details.shelfId && item.level === details.level && item.slot === details.slot);
        if (occupied) return "That position is occupied. Choose an open position.";

        const savedItem = {
            ...details,
            id: selectedItem?.id ?? crypto.randomUUID(),
            name: details.name.trim(),
            description: details.description.trim(),
        };
        const items = selectedItem
            ? data.items.map((item) => item.id === selectedItem.id ? savedItem : item)
            : [...data.items, savedItem];

        updateData({ ...data, items }, `${savedItem.name} ${selectedItem ? "updated" : "added"}.`);
        setRoomId(destination.roomId);
        setShelfId(destination.id);
        if (!selectedItem) setFormNumber((number) => number + 1);
        return null;
    }


    function removeItem(id: string) {
        updateData({ ...data, items: data.items.filter((item) => item.id !== id) }, "Item removed.");
        if (selectedItemId === id) setSelectedItemId(null);
    }

    function removeShelf() {
        if (!shelf || data.items.some((item) => item.shelfId === shelf.id)) return;
        const shelves = data.shelves.filter((entry) => entry.id !== shelf.id);
        updateData({ ...data, shelves }, "Empty shelf removed.");
        setShelfId(shelves.find((entry) => entry.roomId === roomId)?.id ?? "");
        setSelectedItemId(null);
    }

    function removeRoom() {
        if (!room || roomShelves.length > 0) return;
        const rooms = data.rooms.filter((entry) => entry.id !== room.id);
        updateData({ ...data, rooms }, "Empty room removed.");
        const nextRoom = rooms[0]?.id ?? "";
        setRoomId(nextRoom);
        setShelfId(data.shelves.find((entry) => entry.roomId === nextRoom)?.id ?? "");
        setSelectedItemId(null);
    }

    function loadExample() {
        // The example button is only offered when there are no rooms to replace.
        if (data.rooms.length > 0) return;
        const example = createExampleData();
        updateData(example, "Example collection loaded. You can edit it or add your own rooms.");
        setRoomId(example.rooms[0].id);
        setShelfId(example.shelves[0].id);
        setSelectedItemId(null);
    }


    const query = search.trim().toLowerCase();
    const visibleItems = query ? data.items.filter((item) => {
        const itemShelf = data.shelves.find((entry) => entry.id === item.shelfId);
        const itemRoom = data.rooms.find((entry) => entry.id === itemShelf?.roomId);
        return `${item.name} ${item.type} ${item.description} ${itemShelf?.name} ${itemRoom?.name}`.toLowerCase().includes(query);
    }) : roomItems;
    const shelfHasItems = data.items.some((item) => item.shelfId === shelfId);


    return (
        <main className="ss-page">
            <div className="ss-shell">

                <header className="ss-header">
                    <div>
                        <p className="ss-eyebrow">Collection workspace</p>
                        <h1>ShelfSpace 3D</h1>
                        <p className="ss-subtitle">A place for everything. See where it belongs.</p>
                    </div>
                    <div className="ss-header-links">
                        <span className="ss-badge">Saved in this browser</span>
                        <Link href="/" className="ss-home-link">Back to home</Link>
                    </div>
                </header>

                <div className="ss-messages" aria-live="polite">
                    {!loaded && <p role="status">Opening your collection...</p>}
                    {notice && <p role="status">{notice}</p>}
                    {storageError && <p className="ss-error" role="alert">{storageError}</p>}
                    {error && <p className="ss-error" role="alert">{error}</p>}
                </div>


                <div className="ss-workspace">
                    <aside className="ss-panel ss-locations" aria-labelledby="locations-title">
                        <p className="ss-eyebrow">Your space</p>
                        <h2 id="locations-title">Rooms & shelves</h2>

                        <label className="ss-field">
                            Current room
                            <select value={roomId} disabled={!loaded || !data.rooms.length} onChange={(event) => selectRoom(event.target.value)}>
                                {!data.rooms.length && <option value="">No rooms yet</option>}
                                {data.rooms.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                            </select>
                        </label>

                        <form onSubmit={addRoom} className="ss-small-form">
                            <label className="ss-field">
                                New room name
                                <input value={roomName} onChange={(event) => setRoomName(event.target.value)} required disabled={!loaded} placeholder="e.g. Mineral Gallery" />
                            </label>
                            <button className="ss-button ss-button-secondary" disabled={!loaded}>Create room</button>
                        </form>

                        {loaded && !data.rooms.length && (
                            <button type="button" className="ss-button ss-button-primary" onClick={loadExample}>Start with an example</button>
                        )}

                        <div className="ss-divider" />
                        <h3>Shelves in this room</h3>
                        <div className="ss-shelf-list">
                            {roomShelves.map((entry) => (
                                <button type="button" key={entry.id} aria-pressed={shelfId === entry.id}
                                    className={`ss-shelf-button ${shelfId === entry.id ? "ss-selected" : ""}`} onClick={() => selectShelf(entry.id)}>
                                    <span>{entry.name}</span>
                                    <small>{data.items.filter((item) => item.shelfId === entry.id).length} / {entry.levels * entry.slots} positions</small>
                                </button>
                            ))}
                            {!roomShelves.length && <p className="ss-note">Add a shelf to give your items a place.</p>}
                        </div>

                        <form onSubmit={addShelf} className="ss-small-form">
                            <fieldset disabled={!loaded || !room}>
                                <label className="ss-field">
                                    New shelf or case name
                                    <input value={shelfName} onChange={(event) => setShelfName(event.target.value)} required placeholder="e.g. Display A" />
                                </label>
                                <div className="ss-form-grid">
                                    <label className="ss-field">Levels
                                        <input type="number" min="1" max="6" value={levels} onChange={(event) => setLevels(Number(event.target.value))} required />
                                    </label>
                                    <label className="ss-field">Positions / level
                                        <input type="number" min="1" max="8" value={slots} onChange={(event) => setSlots(Number(event.target.value))} required />
                                    </label>
                                </div>
                                <button className="ss-button ss-button-secondary">Create shelf</button>
                            </fieldset>
                        </form>

                        <details className="ss-cleanup">
                            <summary>Remove empty spaces</summary>
                            <p className="ss-note">Remove items before deleting a shelf. Remove shelves before deleting a room.</p>
                            <button type="button" className="ss-button ss-button-secondary" disabled={!shelf || shelfHasItems} onClick={removeShelf}>Remove empty shelf</button>
                            <button type="button" className="ss-button ss-button-secondary" disabled={!room || roomShelves.length > 0} onClick={removeRoom}>Remove empty room</button>
                        </details>
                    </aside>


                    <div className="ss-center">
                        <section className="ss-panel ss-view-panel" aria-labelledby="view-title">
                            <div className="ss-section-header">
                                <div>
                                    <p className="ss-eyebrow">Room view</p>
                                    <h2 id="view-title">{room?.name ?? "Your next collection starts here"}</h2>
                                </div>
                                <button type="button" className="ss-button ss-button-secondary" onClick={() => setViewNumber(viewNumber + 1)} disabled={!room}>Reset view</button>
                            </div>
                            <div className="ss-scene">
                                {loaded && room ? (
                                    <Scene key={`${roomId}:${roomShelves.length}:${viewNumber}`} room={room} shelves={roomShelves} items={roomItems}
                                        selectedItemId={selectedItemId} selectedShelfId={shelfId}
                                        onSelectItem={selectItem} onSelectShelf={selectShelf} />
                                ) : <p className="ss-scene-message">Create a room or load the example to begin.</p>}
                            </div>
                            <p className="ss-view-help">Drag to look around · Scroll or pinch to zoom · Select an item to edit it</p>
                            <div className="ss-room-summary">
                                <span>{roomShelves.length} shelves</span><span>{roomItems.length} items</span>
                                <span>{roomShelves.reduce((total, entry) => total + entry.levels * entry.slots, 0) - roomItems.length} open positions</span>
                            </div>
                        </section>


                        <section className="ss-panel" aria-labelledby="items-title">
                            <div className="ss-section-header">
                                <h2 id="items-title">{query ? "Search results" : "Items in this room"}</h2>
                                <span className="ss-count">{visibleItems.length}</span>
                            </div>
                            <label className="ss-field ss-search">
                                Search all rooms
                                <input type="search" placeholder="Find an item, room, or shelf..." value={search} onChange={(event) => setSearch(event.target.value)} />
                            </label>

                            <ul className="ss-item-list">
                                {visibleItems.map((item) => {
                                    const itemShelf = data.shelves.find((entry) => entry.id === item.shelfId);
                                    const itemRoom = data.rooms.find((entry) => entry.id === itemShelf?.roomId);
                                    return (
                                        <li key={item.id} className={selectedItemId === item.id ? "ss-item-row ss-selected" : "ss-item-row"}>
                                            <button type="button" className="ss-item-select" onClick={() => selectItem(item.id)} aria-pressed={selectedItemId === item.id}>
                                                <span className={`ss-type-dot ss-type-${item.type.toLowerCase()}`} aria-hidden="true" />
                                                <span><strong>{item.name}</strong><small>{itemRoom?.name} / {itemShelf?.name} · Level {item.level + 1}, Position {item.slot + 1}</small></span>
                                            </button>
                                            <span className="ss-item-type">{item.type}</span>
                                            <button type="button" className="ss-remove" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}>Remove</button>
                                        </li>
                                    );
                                })}
                            </ul>
                            {loaded && !visibleItems.length && <p className="ss-empty">{query ? "No items match your search." : "No items here yet. Add one using the item form."}</p>}
                        </section>
                    </div>


                    <aside className="ss-panel ss-editor" aria-labelledby="editor-title">
                        <div className="ss-section-header">
                            <div>
                                <p className="ss-eyebrow">Item details</p>
                                <h2 id="editor-title">{selectedItem ? "Edit selected item" : "Add an item"}</h2>
                            </div>
                            {selectedItem && <button type="button" className="ss-button ss-button-secondary" onClick={() => setSelectedItemId(null)}>New item</button>}
                        </div>
                        <p className="ss-note">Choose a shelf, level, and open position. Saving updates the 3D view too.</p>

                        {/* Barcode lookup can pass item details into this same form later. */}
                        <ItemForm key={selectedItem ? `edit:${selectedItem.id}` : `add:${shelfId}:${formNumber}`}
                            shelves={formShelves} items={data.items} item={selectedItem} defaultShelfId={shelfId}
                            onSave={saveItem} onCancel={() => setSelectedItemId(null)} disabled={!loaded || !data.shelves.length} />

                        {selectedItem && <button type="button" className="ss-button ss-button-danger" onClick={() => removeItem(selectedItem.id)}>Remove selected item</button>}
                        {!data.shelves.length && <p className="ss-note">Create a room and shelf first.</p>}
                    </aside>
                </div>

                <footer className="ss-footer">Working team template · Changes are saved on this device and browser.</footer>
            </div>
        </main>
    );
}
