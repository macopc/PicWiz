import { Editor } from "@/components/editor";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#canvas">
        Skip to canvas
      </a>
      <Editor />
      <noscript>
        <div className="noscript">
          Shinyshot keeps your screenshots on your device. Enable JavaScript to
          import, style, and export an image. No sign-in or upload is needed.
        </div>
      </noscript>
    </>
  );
}
