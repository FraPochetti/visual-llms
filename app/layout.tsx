import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Visual Neurons",
    description: "Image-first creative app powered by Imagen 4, Nano Banana and Veo 3.1 (via Replicate)",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased" suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}

