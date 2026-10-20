// These are the records shared by the forms, storage, and 3D scene.
// The database teammate can use the same fields when connecting D1.

export type ItemType = "Book" | "Gemstone" | "Painting" | "Model" | "Other";

export type Room = {
    id: string;
    name: string;
};

export type Shelf = {
    id: string;
    roomId: string;
    name: string;
    levels: number;
    slots: number;
};

export type Item = {
    id: string;
    name: string;
    type: ItemType;
    description: string;
    shelfId: string;
    level: number;
    slot: number;
};

export type OrganizerData = {
    rooms: Room[];
    shelves: Shelf[];
    items: Item[];
};

// A form supplies everything except the ID. Both adding and editing use this.
export type ItemDetails = Omit<Item, "id">;
