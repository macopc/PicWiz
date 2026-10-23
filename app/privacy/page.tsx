import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
export const metadata = { title: "Privacy — Shinyshot" };
export default function Privacy() {
  return (
    <main className="privacy-page">
      <Link className="text-button" href="/">
        <ArrowLeft size={16} /> Back to editor
      </Link>
      <div className="privacy-icon">
        <ShieldCheck size={28} />
      </div>
      <h1>Your screenshot stays yours.</h1>
      <p>
        Shinyshot opens, renders, and exports your screenshots entirely in your
        browser. We never upload your images. There are no accounts, tracking
        scripts, or cloud libraries.
      </p>
      <h2>What is saved</h2>
      <p>
        Your current image, last-used settings, saved styles, and the last 20
        export results are stored in this browser’s localStorage. Images are
        resized when necessary to keep editing fast and fit browser storage
        limits. Saved style thumbnails contain a neutral illustration, never
        your screenshot.
      </p>
      <h2>You are in control</h2>
      <p>
        “Reset style” restores the default look. “Clear local data” in the
        editor’s help menu deletes your image, presets, and local export
        history. It cannot delete images you have already downloaded or copied.
        Your browser may also remove local data; private browsing usually clears
        it when the session ends.
      </p>
      <h2>Shared devices and browser limits</h2>
      <p>
        Anyone using this browser profile can access its saved composition. Use
        a separate profile or clear local data when finished. Clipboard image
        support depends on your browser and requires HTTPS or localhost; PNG
        download is always available as an alternative.
      </p>
      <h2>Website requests</h2>
      <p>
        Your browser requests the application and a bundled example image.
        Uploaded screenshots never appear in network requests. The health
        diagnostic logs a random request identifier and status, without personal
        data. Your hosting provider may maintain its own standard access logs.
      </p>
      <p className="privacy-note">
        No uploads. No account. Just a little shine.
      </p>
    </main>
  );
}
