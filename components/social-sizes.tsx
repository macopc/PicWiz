"use client";
import { Check, Crop } from "lucide-react";
import { SIZES, type Style } from "@/lib/domain";

const contexts = {
  landscape: "A wide composition for a product update or an X image post.",
  square: "A flexible 1:1 canvas for a balanced social composition.",
  portrait: "A 4:5 composition with a little more vertical space.",
  story: "A 9:16 vertical canvas. Leave room for your platform’s controls.",
  linkedin:
    "A LinkedIn Page link image, rather than a universal post requirement.",
  pinterest: "The recommended 2:3 composition for a standard image ad.",
};

export function SocialSizes({
  value,
  scale,
  onSelect,
}: {
  value: Style["size"];
  scale: Style["scale"];
  onSelect: (size: Style["size"]) => void;
}) {
  return (
    <>
      <span className="dialog-symbol">
        <Crop size={23} />
      </span>
      <h2 id="dialog-title">A good fit for your next post.</h2>
      <p className="dialog-description">
        Choose a composition. Your whole screenshot stays in frame.
      </p>
      <div className="social-size-grid">
        {Object.entries(SIZES).map(([id, size]) => (
          <button
            key={id}
            aria-label={`Use ${size.label}`}
            aria-pressed={value === id}
            className={value === id ? "selected" : ""}
            onClick={() => onSelect(id as Style["size"])}
          >
            <span className="size-ratio">
              <i
                style={{
                  aspectRatio: `${size.width}/${size.height}`,
                  height: size.height > size.width ? 42 : undefined,
                  width: size.height <= size.width ? 62 : undefined,
                }}
              />
            </span>
            <span className="size-card-title">
              <strong>{size.label}</strong>
              {value === id && <Check size={14} />}
            </span>
            <span className="size-pixels">
              {size.width * scale} × {size.height * scale} px{" "}
              <small>at {scale}×</small>
            </span>
            <p>{contexts[id as keyof typeof contexts]}</p>
          </button>
        ))}
      </div>
      <p className="dialog-footnote">
        Composition presets do not guarantee upload acceptance or prevent every
        platform crop.
      </p>
    </>
  );
}
