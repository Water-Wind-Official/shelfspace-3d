"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";


// One item has a name and a location we can look up later.
type Item = {
    id: string;
    name: string;
    type: string;
    room: string;
    shelf: string;
};

const storageKey = "shelfspace-items";


export default function ShelfSpace3D() {

    const [items, setItems] = useState<Item[]>([]);

    // These hold what the user is typing into the form.
    const [name, setName] = useState("");
    const [itemType, setItemType] = useState("Book");
    const [room, setRoom] = useState("");
    const [shelf, setShelf] = useState("");
    const [search, setSearch] = useState("");

    const [loaded, setLoaded] = useState(false);
    const [formError, setFormError] = useState("");
    const [storageError, setStorageError] = useState("");


    // Get this browser's saved list when the page first opens.
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);

            if (saved) {
                const savedItems = JSON.parse(saved);

                // Don't try to display a saved list with missing fields.
                if (!Array.isArray(savedItems) || savedItems.some((item) =>
                    !item ||
                    typeof item.id !== "string" ||
                    typeof item.name !== "string" ||
                    typeof item.type !== "string" ||
                    typeof item.room !== "string" ||
                    typeof item.shelf !== "string"
                )) {
                    throw new Error("The saved item list is invalid.");
                }

                setItems(savedItems);
            }
        } catch {
            setStorageError("Saved items could not be opened. Adding an item will start a new list.");
        }

        setLoaded(true);
    }, []);


    function saveItems(nextItems: Item[]) {
        setItems(nextItems);

        // This is local browser storage for now. The database can take over later.
        try {
            localStorage.setItem(storageKey, JSON.stringify(nextItems));
            setStorageError("");
        } catch {
            setStorageError("Browser saving is unavailable. Changes will be lost when you leave this page.");
        }
    }


    function addItem(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();  // Keep the form from reloading the whole page.

        if (!loaded) return;

        if (!name.trim() || !room.trim() || !shelf.trim()) {
            setFormError("Enter an item name, room, and shelf. Spaces alone don't count.");
            return;
        }

        const newItem: Item = {
            id: crypto.randomUUID(),
            name: name.trim(),
            type: itemType,
            room: room.trim(),
            shelf: shelf.trim(),
        };

        saveItems([...items, newItem]);
        setFormError("");
        setName("");

        // Keep the room and shelf filled in so adding the next item is easier.
    }


    function removeItem(id: string) {
        const remainingItems = items.filter((item) => item.id !== id);
        saveItems(remainingItems);
    }

    const searchText = search.trim().toLowerCase();
    const visibleItems = items.filter((item) =>
        `${item.name} ${item.type} ${item.room} ${item.shelf}`
            .toLowerCase().includes(searchText)
    );


    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6">

            <header className="space-y-2">
                <h1 className="text-2xl font-bold">ShelfSpace 3D</h1>
                <Link href="/" className="underline">Back to home</Link>
                <p>Keep track of your items and where they are stored.</p>
                <p className="text-sm">Items are saved in this browser only.</p>
            </header>

            {storageError && <p role="alert">{storageError}</p>}


            <section aria-labelledby="organizer-heading" className="space-y-2">

                <h2 id="organizer-heading" className="text-xl font-semibold">Organizer</h2>

                {/* The team's 3D scene will go in this spot later. */}
                <div className="rounded border border-dashed p-6">
                    <p>3D view will go here.</p>
                </div>

            </section>


            <section aria-labelledby="add-heading" className="space-y-3">

                <h2 id="add-heading" className="text-xl font-semibold">Add an item</h2>

                <form onSubmit={addItem} className="space-y-3">
                    <fieldset disabled={!loaded} className="grid gap-3 sm:grid-cols-2">

                        <label>
                            Item name
                            <input
                                className="block w-full rounded border p-2"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                required
                            />
                        </label>

                        <label>
                            Type
                            <select
                                className="block w-full rounded border bg-background p-2"
                                value={itemType}
                                onChange={(event) => setItemType(event.target.value)}
                            >
                                <option>Book</option>
                                <option>Gemstone</option>
                                <option>Painting</option>
                                <option>Model</option>
                                <option>Other</option>
                            </select>
                        </label>

                        <label>
                            Room
                            <input
                                className="block w-full rounded border p-2"
                                placeholder="Example: Exhibit Room 1"
                                value={room}
                                onChange={(event) => setRoom(event.target.value)}
                                required
                            />
                        </label>

                        <label>
                            Shelf or display case
                            <input
                                className="block w-full rounded border p-2"
                                placeholder="Example: Shelf A"
                                value={shelf}
                                onChange={(event) => setShelf(event.target.value)}
                                required
                            />
                        </label>

                    </fieldset>

                    {formError && <p role="alert">{formError}</p>}
                    <button type="submit" disabled={!loaded} className="rounded border px-4 py-2 disabled:opacity-50">
                        Add item
                    </button>
                </form>

            </section>


            <section aria-labelledby="items-heading" className="space-y-3">

                <h2 id="items-heading" className="text-xl font-semibold">Items ({items.length})</h2>

                <label className="block">
                    Search by name, type, room, or shelf
                    <input
                        type="search"
                        className="block w-full rounded border p-2"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>

                {!loaded ? (
                    <p role="status">Loading saved items...</p>
                ) : items.length === 0 ? (
                    <p>No items yet. Add your first item above.</p>
                ) : visibleItems.length === 0 ? (
                    <p>No items match your search.</p>
                ) : (
                    <ul className="space-y-3">

                        {/* Each saved item gets its own row. */}
                        {visibleItems.map((item) => (
                            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                                <div className="min-w-0 break-words">
                                    <h3 className="font-semibold">{item.name}</h3>
                                    <p>{item.type}</p>
                                    <p>Room: {item.room} — Shelf / case: {item.shelf}</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    aria-label={`Remove ${item.name}`}
                                    className="rounded border px-3 py-1"
                                >
                                    Remove
                                </button>
                            </li>
                        ))}

                    </ul>
                )}

            </section>

        </main>
    );

}
