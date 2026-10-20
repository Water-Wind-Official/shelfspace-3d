import type { Item, ItemType, OrganizerData, Room, Shelf } from "./shelfspace-types";


const storageKey = "shelfspace-layout-v1";
const legacyStorageKey = "shelfspace-items";

export const itemTypes: ItemType[] = ["Book", "Gemstone", "Painting", "Model", "Other"];


export function createExampleData(): OrganizerData {
    return {
        rooms: [
            { id: "example-room", name: "Example Room" },
        ],
        shelves: [
            { id: "example-bookshelf", roomId: "example-room", name: "Bookshelf", levels: 3, slots: 4 },
            { id: "example-display-case", roomId: "example-room", name: "Display Case", levels: 3, slots: 4 },
        ],
        items: [
            { id: "example-book", name: "Favorite Book", type: "Book", description: "A book from your collection.", shelfId: "example-bookshelf", level: 0, slot: 0 },
            { id: "example-model", name: "Model Rocket", type: "Model", description: "A small display model.", shelfId: "example-bookshelf", level: 1, slot: 2 },
            { id: "example-gemstone", name: "Amethyst", type: "Gemstone", description: "A purple gemstone specimen.", shelfId: "example-display-case", level: 0, slot: 1 },
            { id: "example-painting", name: "Small Landscape", type: "Painting", description: "A miniature framed painting.", shelfId: "example-display-case", level: 1, slot: 0 },
        ],
    };
}


function readRecord(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label} must be an object.`);
    }

    return value as Record<string, unknown>;
}


function readText(value: unknown, label: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} must be nonblank text.`);
    }

    return value;
}


function readInteger(value: unknown, minimum: number, label: string): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
        throw new Error(`${label} must be a whole number of at least ${minimum}.`);
    }

    return value;
}


function checkUniqueId(ids: Set<string>, id: string, label: string) {
    if (ids.has(id)) {
        throw new Error(`${label} has a duplicate ID: ${id}.`);
    }

    ids.add(id);
}


// Check imported and saved data before it reaches the forms or the 3D scene.
export function validateOrganizer(value: unknown): OrganizerData {
    const data = readRecord(value, "The layout");

    if (!Array.isArray(data.rooms) || !Array.isArray(data.shelves) || !Array.isArray(data.items)) {
        throw new Error("The layout must contain rooms, shelves, and items arrays.");
    }

    const roomIds = new Set<string>();
    const shelfIds = new Set<string>();
    const itemIds = new Set<string>();

    const rooms: Room[] = data.rooms.map((value, index) => {
        const label = `Room ${index + 1}`;
        const room = readRecord(value, label);
        const id = readText(room.id, `${label} ID`);
        checkUniqueId(roomIds, id, label);

        return { id, name: readText(room.name, `${label} name`) };
    });

    const shelves: Shelf[] = data.shelves.map((value, index) => {
        const label = `Shelf ${index + 1}`;
        const shelf = readRecord(value, label);
        const id = readText(shelf.id, `${label} ID`);
        checkUniqueId(shelfIds, id, label);

        const roomId = readText(shelf.roomId, `${label} room ID`);

        if (!roomIds.has(roomId)) {
            throw new Error(`${label} refers to a room that does not exist.`);
        }

        return {
            id,
            roomId,
            name: readText(shelf.name, `${label} name`),
            levels: readInteger(shelf.levels, 1, `${label} levels`),
            slots: readInteger(shelf.slots, 1, `${label} slots`),
        };
    });

    const shelvesById = new Map(shelves.map((shelf) => [shelf.id, shelf]));
    const occupiedPositions = new Set<string>();

    const items: Item[] = data.items.map((value, index) => {
        const label = `Item ${index + 1}`;
        const item = readRecord(value, label);
        const id = readText(item.id, `${label} ID`);
        checkUniqueId(itemIds, id, label);

        if (!itemTypes.includes(item.type as ItemType)) {
            throw new Error(`${label} must have a supported item type.`);
        }

        if (typeof item.description !== "string") {
            throw new Error(`${label} description must be text.`);
        }

        const shelfId = readText(item.shelfId, `${label} shelf ID`);
        const shelf = shelvesById.get(shelfId);

        if (!shelf) {
            throw new Error(`${label} refers to a shelf that does not exist.`);
        }

        const level = readInteger(item.level, 0, `${label} level`);
        const slot = readInteger(item.slot, 0, `${label} slot`);

        if (level >= shelf.levels || slot >= shelf.slots) {
            throw new Error(`${label} is outside its shelf's available positions.`);
        }

        const position = JSON.stringify([shelfId, level, slot]);

        if (occupiedPositions.has(position)) {
            throw new Error(`${label} shares a position with another item.`);
        }

        occupiedPositions.add(position);

        return {
            id,
            name: readText(item.name, `${label} name`),
            type: item.type as ItemType,
            description: item.description,
            shelfId,
            level,
            slot,
        };
    });

    return { rooms, shelves, items };
}


function migrateLegacyItems(value: unknown): OrganizerData {
    if (!Array.isArray(value)) {
        throw new Error("The saved item list must be an array.");
    }

    const rooms: Room[] = [];
    const shelves: Shelf[] = [];
    const items: Item[] = [];
    const roomsByName = new Map<string, Room>();
    const shelvesByName = new Map<string, Shelf>();
    const shelfCounts = new Map<string, number>();
    const itemIds = new Set<string>();

    value.forEach((value, index) => {
        const label = `Saved item ${index + 1}`;
        const oldItem = readRecord(value, label);

        for (const field of ["id", "name", "type", "room", "shelf"]) {
            if (typeof oldItem[field] !== "string") {
                throw new Error(`${label} has an invalid ${field}.`);
            }
        }

        const roomName = (oldItem.room as string).trim() || "Unassigned Room";
        let room = roomsByName.get(roomName);

        if (!room) {
            room = { id: `legacy-room-${rooms.length + 1}`, name: roomName };
            rooms.push(room);
            roomsByName.set(roomName, room);
        }

        const shelfName = (oldItem.shelf as string).trim() || "Unassigned Shelf";
        const shelfKey = JSON.stringify([room.id, shelfName]);
        let shelf = shelvesByName.get(shelfKey);

        if (!shelf) {
            shelf = {
                id: `legacy-shelf-${shelves.length + 1}`,
                roomId: room.id,
                name: shelfName,
                levels: 3,
                slots: 4,
            };

            shelves.push(shelf);
            shelvesByName.set(shelfKey, shelf);
        }

        const count = shelfCounts.get(shelf.id) ?? 0;
        const level = Math.floor(count / shelf.slots);
        const slot = count % shelf.slots;

        // An older list had no capacity limit, so grow shelves to retain every item.
        shelf.levels = Math.max(shelf.levels, level + 1);
        shelfCounts.set(shelf.id, count + 1);

        let id = (oldItem.id as string).trim() || `legacy-item-${index + 1}`;

        while (itemIds.has(id)) {
            id = `${id}-migrated`;
        }

        itemIds.add(id);

        const oldType = oldItem.type as string;
        const type = itemTypes.includes(oldType as ItemType) ? oldType as ItemType : "Other";

        items.push({
            id,
            name: (oldItem.name as string).trim() || "Unnamed Item",
            type,
            description: type === oldType ? "" : `Original item type: ${oldType}`,
            shelfId: shelf.id,
            level,
            slot,
        });
    });

    return validateOrganizer({ rooms, shelves, items });
}


export function loadOrganizer(): OrganizerData {
    if (typeof window === "undefined") {
        return createExampleData();
    }

    const saved = window.localStorage.getItem(storageKey);

    if (saved !== null) {
        return validateOrganizer(JSON.parse(saved));
    }

    const legacy = window.localStorage.getItem(legacyStorageKey);

    if (legacy !== null) {
        return migrateLegacyItems(JSON.parse(legacy));
    }

    return createExampleData();
}


export function saveOrganizer(data: OrganizerData): void {
    if (typeof window === "undefined") {
        throw new Error("Browser saving is unavailable outside the browser.");
    }

    window.localStorage.setItem(storageKey, JSON.stringify(validateOrganizer(data)));
}


// Positions use zero-based indices. Skip the edited item when looking for space.
export function findOpenPosition(shelf: Shelf, items: Item[], ignoreId?: string): { level: number; slot: number } | null {
    const occupied = new Set(
        items
            .filter((item) => item.shelfId === shelf.id && item.id !== ignoreId)
            .map((item) => `${item.level}:${item.slot}`),
    );

    for (let level = 0; level < shelf.levels; level += 1) {
        for (let slot = 0; slot < shelf.slots; slot += 1) {
            if (!occupied.has(`${level}:${slot}`)) {
                return { level, slot };
            }
        }
    }

    return null;
}
