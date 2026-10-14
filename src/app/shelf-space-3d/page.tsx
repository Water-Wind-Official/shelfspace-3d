import Link from "next/link";


export default function ShelfSpace3D() {

    // This is what shows up when someone opens this page
    return (
        <main>

            <h1>ShelfSpace 3D</h1>

            {/* Takes us back to the home page */}
            <Link href="/">Back to home</Link>


            <section>

                <h2>Organizer</h2>

                {/* The team's 3D scene will go in this spot later. */}
                <p>3D view will go here.</p>

            </section>

        </main>
    );

}
