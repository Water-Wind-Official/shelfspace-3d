"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { findOpenPosition, itemTypes } from "@/lib/shelfspace-data";
import type { Item, ItemDetails, ItemType, Shelf } from "@/lib/shelfspace-types";


type ItemFormProps = {
    shelves: Shelf[];
    items: Item[];
    item: Item | null;
    defaultShelfId: string;
    onSave: (details: ItemDetails) => string | null;
    onCancel: () => void;
    disabled?: boolean;
};


export default function ItemForm({ shelves, items, item, defaultShelfId, onSave, onCancel, disabled = false }: ItemFormProps) {

    const initialShelfId = item?.shelfId ?? defaultShelfId;
    const initialShelf = shelves.find((shelf) => shelf.id === initialShelfId);
    const initialPosition = initialShelf ? findOpenPosition(initialShelf, items, item?.id) : null;

    // An existing item fills the form in when we are editing it.
    const [name, setName] = useState(item?.name ?? "");
    const [type, setType] = useState<ItemType>(item?.type ?? "Book");
    const [description, setDescription] = useState(item?.description ?? "");
    const [shelfId, setShelfId] = useState(initialShelfId);
    const [level, setLevel] = useState(item?.level ?? initialPosition?.level ?? 0);
    const [slot, setSlot] = useState(item?.slot ?? initialPosition?.slot ?? 0);
    const [error, setError] = useState("");

    const selectedShelf = shelves.find((shelf) => shelf.id === shelfId);
    const formDisabled = disabled || shelves.length === 0;
    const shelfIsFull = selectedShelf && !findOpenPosition(selectedShelf, items, item?.id);


    function changeShelf(nextShelfId: string) {
        setShelfId(nextShelfId);

        // Pick an empty spot, since the new shelf could be smaller or nearly full.
        const nextShelf = shelves.find((shelf) => shelf.id === nextShelfId);
        const nextPosition = nextShelf ? findOpenPosition(nextShelf, items, item?.id) : null;

        setLevel(nextPosition?.level ?? 0);
        setSlot(nextPosition?.slot ?? 0);
        setError("");
    }


    function positionIsTaken(checkLevel: number, checkSlot: number) {
        return items.some((savedItem) =>
            savedItem.id !== item?.id &&
            savedItem.shelfId === shelfId &&
            savedItem.level === checkLevel &&
            savedItem.slot === checkSlot
        );
    }


    function changeLevel(nextLevel: number) {
        const openSlot = Array.from({ length: selectedShelf?.slots ?? 0 }, (_, index) => index)
            .find((index) => !positionIsTaken(nextLevel, index));

        setLevel(nextLevel);
        setSlot(openSlot ?? 0);
        setError(openSlot === undefined ? "This level is full. Choose another level." : "");
    }


    function saveItem(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (formDisabled) return;

        if (!name.trim()) {
            setError("Enter an item name. Spaces alone don't count.");
            return;
        }

        if (!selectedShelf) {
            setError("Choose a shelf for this item.");
            return;
        }

        // Barcode lookup can fill these same fields when it is connected later.
        const saveError = onSave({
            name: name.trim(),
            type,
            description: description.trim(),
            shelfId,
            level,
            slot,
        });

        if (saveError) {
            setError(saveError);
            return;
        }

        setError("");

        if (!item) {
            setName("");
            setDescription("");
        }
    }


    return (
        <form onSubmit={saveItem}>

            {shelves.length === 0 && (
                <p className="ss-note">Add a shelf before adding an item.</p>
            )}

            <div className="ss-form-grid">

                <label className="ss-field">
                    <span>Item name</span>
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={formDisabled}
                        required
                    />
                </label>

                <label className="ss-field">
                    <span>Type</span>
                    <select
                        value={type}
                        onChange={(event) => setType(event.target.value as ItemType)}
                        disabled={formDisabled}
                    >
                        {itemTypes.map((itemType) => (
                            <option key={itemType} value={itemType}>{itemType}</option>
                        ))}
                    </select>
                </label>

                <label className="ss-field">
                    <span>Shelf</span>
                    <select
                        value={shelfId}
                        onChange={(event) => changeShelf(event.target.value)}
                        disabled={formDisabled}
                        required
                    >
                        {!selectedShelf && <option value="">Choose a shelf</option>}
                        {shelves.map((shelf) => (
                            <option key={shelf.id} value={shelf.id}>{shelf.name}</option>
                        ))}
                    </select>
                </label>

                <label className="ss-field">
                    <span>Level</span>
                    <select
                        value={level}
                        onChange={(event) => changeLevel(Number(event.target.value))}
                        disabled={formDisabled || !selectedShelf}
                    >
                        {Array.from({ length: selectedShelf?.levels ?? 0 }, (_, index) => (
                            <option key={index} value={index}>Level {index + 1}</option>
                        ))}
                    </select>
                </label>

                <label className="ss-field">
                    <span>Position</span>
                    <select
                        value={slot}
                        onChange={(event) => {
                            setSlot(Number(event.target.value));
                            setError("");
                        }}
                        disabled={formDisabled || !selectedShelf}
                    >
                        {Array.from({ length: selectedShelf?.slots ?? 0 }, (_, index) => (
                            <option key={index} value={index} disabled={positionIsTaken(level, index)}>
                                Position {index + 1}{positionIsTaken(level, index) ? " (occupied)" : ""}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="ss-field">
                    <span>Description (optional)</span>
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        disabled={formDisabled}
                        maxLength={240}
                        rows={2}
                    />
                </label>

            </div>


            {shelfIsFull && <p className="ss-note">This shelf is full. Choose another shelf or remove an item.</p>}
            {error && <p className="ss-error" role="alert">{error}</p>}

            <div className="ss-form-actions">
                <button type="submit" className="ss-button ss-button-primary" disabled={formDisabled}>
                    {item ? "Save item" : "Add item"}
                </button>

                {item && (
                    <button
                        type="button"
                        className="ss-button ss-button-secondary"
                        onClick={onCancel}
                        disabled={disabled}
                    >
                        Cancel editing
                    </button>
                )}
            </div>

        </form>
    );
}
