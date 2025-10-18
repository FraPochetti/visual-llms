import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Visual Neurons",
    description: "Image-first creative app powered by Nano Banana (Gemini 2.5 Flash Image)",
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

