"use client";

import { Component, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CanvasTexture, MathUtils, PerspectiveCamera, SRGBColorSpace } from "three";
import type { Item, ItemType, Room, Shelf } from "@/lib/shelfspace-types";


type SceneProps = {
    room: Room | undefined;
    shelves: Shelf[];
    items: Item[];
    selectedItemId: string | null;
    selectedShelfId: string | null;
    onSelectItem: (id: string | null) => void;
    onSelectShelf: (id: string) => void;
};

// These are drawing units, not real-world measurements yet.
const slotWidth = 1.05;
const levelHeight = 1.1;
const shelfDepth = 1.15;
const boardThickness = 0.12;
const bottomHeight = 0.18;
const shelfGap = 0.8;

const itemColors: Record<ItemType, string> = {
    Book: "#608c77",
    Gemstone: "#9978ad",
    Painting: "#c58f58",
    Model: "#64849c",
    Other: "#b18d54",
};

const itemHeights: Record<ItemType, number> = {
    Book: 0.76,
    Gemstone: 0.68,
    Painting: 0.78,
    Model: 0.76,
    Other: 0.62,
};


function getShelfWidth(shelf: Shelf) {
    return shelf.slots * slotWidth + boardThickness * 2;
}


function ViewerFallback() {
    return (
        <div role="status" className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-700">
            <p>3D is unavailable in this browser. You can still manage rooms, shelves, and items using the page's lists and forms.</p>
        </div>
    );
}


// Keep a graphics error inside this viewer so the inventory form keeps working.
class ViewerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? <ViewerFallback /> : this.props.children;
    }
}


function ContextLossHandler({ onLost }: { onLost: (lost: boolean) => void }) {
    const gl = useThree((state) => state.gl);

    useEffect(() => {
        const canvas = gl.domElement;

        function handleLoss(event: Event) {
            event.preventDefault();
            onLost(true);
        }

        canvas.addEventListener("webglcontextlost", handleLoss);
        return () => canvas.removeEventListener("webglcontextlost", handleLoss);
    }, [gl, onLost]);

    return null;
}


// Refit when the room's shelves or viewport size change, including narrow screens.
function FitCamera({ width, height }: { width: number; height: number }) {
    const { camera, size, invalidate } = useThree();

    useEffect(() => {
        if (!(camera instanceof PerspectiveCamera)) return;

        const verticalAngle = MathUtils.degToRad(camera.fov);
        const aspect = size.width / Math.max(size.height, 1);
        const horizontalAngle = 2 * Math.atan(Math.tan(verticalAngle / 2) * aspect);

        const fitWidth = width / (2 * Math.tan(horizontalAngle / 2));
        const fitHeight = height / (2 * Math.tan(verticalAngle / 2));
        const distance = Math.max(fitWidth, fitHeight, 4) * 1.35;
        const targetHeight = height / 2;

        camera.position.set(distance * 0.12, targetHeight + distance * 0.3, distance);
        camera.lookAt(0, targetHeight, 0);
        camera.far = Math.max(100, distance * 5);
        camera.updateProjectionMatrix();
        invalidate();
    }, [camera, width, height, size.width, size.height, invalidate]);

    return null;
}


// The 3D teammate can replace these shapes with models or textures later.
function ItemGeometry({ type }: { type: ItemType }) {
    switch (type) {
        case "Book":
            return <boxGeometry args={[0.4, itemHeights.Book, 0.55]} />;
        case "Gemstone":
            return <octahedronGeometry args={[itemHeights.Gemstone / 2]} />;
        case "Painting":
            return <boxGeometry args={[0.7, itemHeights.Painting, 0.12]} />;
        case "Model":
            return <coneGeometry args={[0.32, itemHeights.Model, 6]} />;
        default:
            return <sphereGeometry args={[itemHeights.Other / 2, 16, 12]} />;
    }
}


// Draw labels locally instead of creating a separate HTML root inside the scene.
function SceneLabel({ text, position, highlighted = false, maxWidth = 360 }: {
    text: string;
    position: [number, number, number];
    highlighted?: boolean;
    maxWidth?: number;
}) {
    const { camera, size } = useThree();

    const label = useMemo(() => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return null;

        const font = "600 26px system-ui, sans-serif";
        const padding = 20;
        context.font = font;

        let displayedText = text;
        while (context.measureText(displayedText).width > maxWidth - padding * 2 && displayedText.length > 1) {
            displayedText = displayedText.slice(0, -1);
        }
        if (displayedText !== text) displayedText = `${displayedText.slice(0, -1)}…`;

        canvas.width = Math.ceil(context.measureText(displayedText).width) + padding * 2;
        canvas.height = 56;

        // Changing canvas dimensions clears its drawing settings, so set them again.
        context.font = font;
        context.fillStyle = highlighted ? "#fef3c7" : "#ffffff";
        context.beginPath();
        context.roundRect(0, 0, canvas.width, canvas.height, 10);
        context.fill();
        context.fillStyle = highlighted ? "#451a03" : "#25352e";
        context.textBaseline = "middle";
        context.fillText(displayedText, padding, canvas.height / 2);

        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        return { texture, aspect: canvas.width / canvas.height };
    }, [text, highlighted, maxWidth]);

    useEffect(() => {
        return () => label?.texture.dispose();
    }, [label]);

    if (!label) return null;

    // Keep text about 24 pixels tall even when the camera fits a large room.
    const angle = camera instanceof PerspectiveCamera ? MathUtils.degToRad(camera.fov) / 2 : Math.PI / 8;
    const height = 24 * 2 * Math.tan(angle) / Math.max(size.height, 1);

    return (
        <sprite position={position} scale={[height * label.aspect, height, 1]} renderOrder={10}>
            <spriteMaterial map={label.texture} transparent sizeAttenuation={false} depthTest={false} depthWrite={false} toneMapped={false} />
        </sprite>
    );
}


type ShelfViewProps = Pick<SceneProps, "selectedItemId" | "selectedShelfId" | "onSelectItem" | "onSelectShelf"> & {
    shelf: Shelf;
    items: Item[];
    x: number;
};


function ShelfView({ shelf, items, x, selectedItemId, selectedShelfId, onSelectItem, onSelectShelf }: ShelfViewProps) {
    const width = getShelfWidth(shelf);
    const height = shelf.levels * levelHeight;
    const selected = shelf.id === selectedShelfId;
    const woodColor = selected ? "#ae8053" : "#92765d";

    return (
        <group position={[x, 0, 0]} onClick={(event) => {
            event.stopPropagation();
            onSelectShelf(shelf.id);
        }}>

            {/* Side panels and a back panel make a simple physical shelf. */}
            {[-1, 1].map((side) => (
                <mesh key={side} position={[side * (width - boardThickness) / 2, bottomHeight + height / 2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[boardThickness, height + boardThickness, shelfDepth]} />
                    <meshStandardMaterial color={woodColor} />
                </mesh>
            ))}

            <mesh position={[0, bottomHeight + height / 2, -shelfDepth / 2]} receiveShadow>
                <boxGeometry args={[width, height + boardThickness, boardThickness]} />
                <meshStandardMaterial color={selected ? "#decaac" : "#cdbba5"} />
            </mesh>

            {/* Level 0 is the bottom board. The last board closes the top. */}
            {Array.from({ length: shelf.levels + 1 }, (_, level) => (
                <mesh key={level} position={[0, bottomHeight + level * levelHeight, 0]} castShadow receiveShadow>
                    <boxGeometry args={[width, boardThickness, shelfDepth]} />
                    <meshStandardMaterial color={woodColor} />
                </mesh>
            ))}

            <SceneLabel text={shelf.name} position={[0, bottomHeight + height + 0.35, 0]} highlighted={selected} />

            {items.map((item) => {
                // Level and slot are stored from zero; each item sits at its slot's center.
                const itemX = (item.slot - (shelf.slots - 1) / 2) * slotWidth;
                const itemY = bottomHeight + item.level * levelHeight + boardThickness / 2 + itemHeights[item.type] / 2;
                const itemSelected = item.id === selectedItemId;

                return (
                    <mesh key={item.id} position={[itemX, itemY, 0]} castShadow onClick={(event) => {
                        event.stopPropagation();
                        onSelectItem(item.id);
                    }}>
                        <ItemGeometry type={item.type} />
                        <meshStandardMaterial
                            color={itemColors[item.type]}
                            emissive={itemSelected ? "#e8a328" : "#000000"}
                            emissiveIntensity={itemSelected ? 0.65 : 0}
                            roughness={0.55}
                        />

                        {itemSelected && (
                            <SceneLabel text={item.name} position={[0, itemHeights[item.type] / 2 + 0.2, 0]} highlighted />
                        )}
                    </mesh>
                );
            })}

        </group>
    );
}


export default function Scene({ room, shelves, items, selectedItemId, selectedShelfId, onSelectItem, onSelectShelf }: SceneProps) {
    const [contextLost, setContextLost] = useState(false);

    const shelvesWidth = shelves.reduce((sum, shelf) => sum + getShelfWidth(shelf), 0) + Math.max(0, shelves.length - 1) * shelfGap;
    const totalWidth = Math.max(4, shelvesWidth);
    const totalHeight = Math.max(3, ...shelves.map((shelf) => shelf.levels * levelHeight + bottomHeight + 0.6));
    const floorWidth = totalWidth + 6;

    // Put shelves side by side, keeping the whole arrangement centered.
    let nextLeft = -shelvesWidth / 2;
    const shelfPositions = shelves.map((shelf) => {
        const x = nextLeft + getShelfWidth(shelf) / 2;
        nextLeft += getShelfWidth(shelf) + shelfGap;
        return { shelf, x };
    });

    return (
        <div className="h-full">
            <div role="region" aria-label={`3D view of ${room?.name ?? "the organizer"}`} className="relative h-full w-full overflow-hidden bg-slate-100">
                <p className="sr-only">Interactive shelf preview. Rooms, shelves, and items can also be selected using the page's lists and forms.</p>

                {!room ? (
                    <div className="flex h-full items-center justify-center p-6 text-sm text-slate-700">Choose a room to see its shelves.</div>
                ) : contextLost ? (
                    <ViewerFallback />
                ) : (
                    <ViewerErrorBoundary>
                        <Canvas
                            shadows
                            frameloop="demand"
                            dpr={[1, 1.5]}
                            camera={{ position: [5, 5, 9], fov: 45 }}
                            fallback={<ViewerFallback />}
                            onPointerMissed={() => onSelectItem(null)}
                            aria-label={`Shelves and stored items in ${room.name}`}
                        >
                            <color attach="background" args={["#edf1f3"]} />
                            <ambientLight intensity={0.8} />
                            <hemisphereLight args={["#ffffff", "#bac5b4", 1]} />
                            <directionalLight
                                position={[5, 10, 8]}
                                intensity={2}
                                castShadow
                                shadow-mapSize={[1024, 1024]}
                                shadow-camera-left={-floorWidth / 2}
                                shadow-camera-right={floorWidth / 2}
                                shadow-camera-top={totalHeight + 4}
                                shadow-camera-bottom={-totalHeight - 4}
                            />

                            {/* A floor and grid give the room a clear scale and orientation. */}
                            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                                <planeGeometry args={[floorWidth, 12]} />
                                <meshStandardMaterial color="#e7ebe5" />
                            </mesh>
                            <gridHelper args={[floorWidth, Math.ceil(floorWidth), "#c1cbc8", "#d3dcd7"]} position={[0, 0.01, 0]} />

                            {shelfPositions.map(({ shelf, x }) => (
                                <ShelfView
                                    key={shelf.id}
                                    shelf={shelf}
                                    x={x}
                                    items={items.filter((item) => item.shelfId === shelf.id)}
                                    selectedItemId={selectedItemId}
                                    selectedShelfId={selectedShelfId}
                                    onSelectItem={onSelectItem}
                                    onSelectShelf={onSelectShelf}
                                />
                            ))}

                            {shelves.length === 0 && (
                                <SceneLabel text="Add a shelf to start arranging this room." position={[0, 1, 0]} maxWidth={620} />
                            )}

                            {/* Change these controls when the team adds item movement later. */}
                            <OrbitControls makeDefault target={[0, totalHeight / 2, 0]} minDistance={2} maxDistance={Math.max(totalWidth, totalHeight) * 6} maxPolarAngle={Math.PI / 2.05} />
                            <FitCamera width={totalWidth} height={totalHeight} />
                            <ContextLossHandler onLost={setContextLost} />
                        </Canvas>
                    </ViewerErrorBoundary>
                )}
            </div>
        </div>
    );
}
