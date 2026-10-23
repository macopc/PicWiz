import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

// A deterministic, fictional product screenshot. No network or user data.
const text = (x, y, value, size = 14, fill = "#7c8093", weight = 400) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="Arial,Helvetica,sans-serif">${value}</text>`;
const rect = (x, y, w, h, r = 0, fill = "#fff", stroke = "none") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const sideItem = (y, label, active = false) =>
  `${active ? rect(17, y - 24, 206, 44, 7, "#ffffff13") : ""}<rect x="34" y="${y - 10}" width="14" height="14" rx="3" fill="none" stroke="${active ? "#baa7ff" : "#71748d"}" stroke-width="1.4"/>${text(64, y + 2, label, 14, active ? "#fff" : "#9a9db2", active ? 500 : 400)}`;
const graph = `<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9c86ed" stop-opacity=".2"/><stop offset="1" stop-color="#a995ee" stop-opacity="0"/></linearGradient></defs>`;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">${graph}${rect(0, 0, 1440, 900, 0, "#f7f8fc")}${rect(0, 0, 240, 900, 0, "#222338")}${rect(240, 0, 1200, 76, 0, "#fff")}<path d="M240 75.5H1440" stroke="#eeeef4"/>`;
svg += `<circle cx="43" cy="39" r="15" fill="#9681e9"/><ellipse cx="43" cy="39" rx="20" ry="7" fill="none" stroke="#c8b9ff" stroke-width="2" transform="rotate(-40 43 39)"/>${text(73, 47, "orbit", 29, "#fff", 600)}${text(29, 112, "WORKSPACE", 10, "#696e88", 600)}`;
svg +=
  sideItem(155, "Overview", true) +
  sideItem(208, "Analytics") +
  sideItem(261, "Customers") +
  sideItem(314, "Products") +
  sideItem(367, "Reports");
svg += `${text(29, 449, "MANAGE", 10, "#696e88", 600)}${sideItem(492, "Integrations")}${sideItem(545, "Settings")}${rect(20, 694, 200, 105, 9, "#ffffff08")}${text(36, 724, "A little room to grow.", 13, "#e5e2f4", 500)}${text(36, 746, "Your next chapter starts here.", 11, "#83879d")}${rect(36, 761, 167, 26, 5, "#9681e5")}${text(81, 779, "Explore Pro", 11, "#fff", 500)}<circle cx="43" cy="848" r="17" fill="#d9cbed"/>${text(32, 853, "AC", 12, "#655180", 600)}${text(71, 845, "Alex Chen", 13, "#efedf7", 500)}${text(71, 864, "Personal workspace", 10, "#7c8096")}${text(210, 852, "⌄", 17, "#8e90a4")}`;
svg += `${text(273, 45, "Workspace", 13, "#9b9bad")}${text(367, 45, "/", 13, "#cbcbd5")}${text(391, 45, "Overview", 13, "#5c5b71", 500)}${text(1187, 45, "⌕", 23, "#9a99ab")}${text(1240, 43, "↗", 20, "#9a99ab")}<circle cx="1301" cy="38" r="15" fill="#f2e9dd"/>${text(1291, 43, "AC", 10, "#9d7f5b", 600)}<circle cx="1370" cy="38" r="16" fill="#f4f2f9"/>${text(1365, 43, "?", 14, "#8c80a9")}`;
svg += `${text(285, 141, "Good morning, Alex", 29, "#2c2c44", 600)}${text(285, 168, "Here’s what’s happening with your business today.", 13, "#9999ad")}${rect(1128, 111, 267, 39, 6, "#fff", "#e4e4ed")}${text(1144, 136, "▦", 14, "#9b9bad")}${text(1171, 136, "Jun 1 – Jun 30, 2025", 12, "#79778d")}${text(1372, 136, "⌄", 13, "#aaa5ba")}`;
const cards = [
  ["Total revenue", "$24,680.00", "↗ 12.8%", "vs. last month"],
  ["Active customers", "1,482", "↗ 8.2%", "vs. last month"],
  ["Conversion rate", "4.86%", "↗ 2.4%", "vs. last month"],
];
for (let i = 0; i < 3; i++) {
  const x = 285 + i * 378;
  svg += `${rect(x, 203, 354, 157, 9, "#fff", "#e9e8f0")}${text(x + 23, 236, cards[i][0], 13, "#9290a5")}${text(x + 318, 235, "↗", 17, "#bab0d2")}${text(x + 23, 282, cards[i][1], 31, "#333048", 500)}${rect(x + 23, 308, 64, 22, 4, "#edf8f1")}${text(x + 30, 323, cards[i][2], 10, "#5d9f7b", 500)}${text(x + 98, 323, cards[i][3], 10, "#b0a9bf")}`;
}
svg += `${rect(285, 386, 733, 321, 9, "#fff", "#e9e8f0")}${text(308, 422, "Revenue overview", 15, "#514862", 500)}${text(897, 422, "This month ⌄", 11, "#a396b2")}`;
for (let i = 0; i < 4; i++) {
  const y = 467 + i * 55;
  svg += `<path d="M365 ${y}H989" stroke="#f1edf6" stroke-dasharray="4 4"/>${text(308, y + 4, ["$30k", "$20k", "$10k", "$0"][i], 10, "#b5a9c1")}`;
}
svg += `<path d="M365 605 C390 605 390 560 421 570 S463 595 481 555 S519 569 545 522 S583 548 610 518 S643 530 667 493 S695 518 723 487 S755 493 781 465 S812 501 841 466 S875 476 905 444 S952 468 989 438 L989 632 L365 632Z" fill="url(#area)"/><path d="M365 605 C390 605 390 560 421 570 S463 595 481 555 S519 569 545 522 S583 548 610 518 S643 530 667 493 S695 518 723 487 S755 493 781 465 S812 501 841 466 S875 476 905 444 S952 468 989 438" fill="none" stroke="#a289e4" stroke-width="3" stroke-linecap="round"/><path d="M365 613 C441 603 483 612 545 584 S635 596 702 562 S766 573 841 544 S937 553 989 521" fill="none" stroke="#d3c9e7" stroke-width="2" stroke-dasharray="5 5"/>`;
for (let i = 0; i < 6; i++)
  svg += text(
    357 + i * 121,
    662,
    ["Jun 1", "Jun 6", "Jun 12", "Jun 18", "Jun 24", "Jun 30"][i],
    10,
    "#b4a7c1",
  );
svg += `${rect(1042, 386, 353, 321, 9, "#fff", "#e9e8f0")}${text(1066, 422, "Top sources", 15, "#514862", 500)}${text(1358, 423, "···", 16, "#b4a3c3")}`;
const channels = [
  ["Direct", 42, "#a18ae0"],
  ["Social", 28, "#bbabe4"],
  ["Search", 18, "#d1c4eb"],
  ["Referral", 12, "#e4daf2"],
];
for (let i = 0; i < 4; i++) {
  const y = 465 + i * 52;
  const [name, v, c] = channels[i];
  svg += `<circle cx="1072" cy="${y - 4}" r="4" fill="${c}"/>${text(1085, y, name, 12, "#9a8ba9")}${text(1342, y, `${v}%`, 11, "#a99ab7")}${rect(1067, y + 12, 304, 5, 2, "#f4eff9")}${rect(1067, y + 12, (304 * v) / 55, 5, 2, c)}`;
}
svg += `${rect(285, 731, 1110, 154, 9, "#fff", "#e9e8f0")}${text(309, 767, "Recent activity", 15, "#514862", 500)}${text(1311, 767, "View all →", 11, "#b09ac9")}`;
const names = ["Olivia Rhye", "Phoenix Baker", "Lana Steiner"];
for (let i = 0; i < 3; i++) {
  const x = 309 + i * 363;
  svg += `<circle cx="${x + 15}" cy="815" r="16" fill="${["#f0e6de", "#e5ecf2", "#f1e5ec"][i]}"/>${text(x + 6, 819, ["OR", "PB", "LS"][i], 10, "#b496ae", 500)}${text(x + 42, 810, names[i], 12, "#a18aaa", 500)}${text(x + 42, 829, "Subscribed to Pro", 10, "#c2afcd")}${text(x + 259, 815, "+$29.00", 11, "#ab91bd")}`;
}
svg += "</svg>";
await mkdir("public", { recursive: true });
await sharp(Buffer.from(svg)).png().toFile("public/example.png");
await mkdir("tests/fixtures", { recursive: true });
await writeFile(
  "tests/fixtures/not-an-image.txt",
  "A friendly rejection keeps your screenshot safe.",
);
const timestamp = "2026-10-23T12:00:00.000Z";
await writeFile(
  "tests/fixtures/recovery-state.json",
  JSON.stringify(
    {
      version: 1,
      composition: {
        id: "current",
        createdAt: timestamp,
        updatedAt: timestamp,
        status: "empty",
        source: null,
        style: {
          background: "violet",
          padding: 96,
          radius: 12,
          shadow: 36,
          frame: "none",
          appearance: "light",
          size: "landscape",
          scale: 1,
        },
      },
      presets: [
        {
          id: "seed-product-updates",
          name: "Product updates",
          style: {
            background: "ocean",
            padding: 100,
            radius: 18,
            shadow: 45,
            frame: "browser",
            appearance: "dark",
            size: "square",
            scale: 1,
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      jobs: [
        {
          id: "seed-interrupted-export",
          compositionId: "current",
          kind: "clipboard",
          status: "pending",
          createdAt: timestamp,
          completedAt: null,
          width: 1600,
          height: 900,
          error: null,
        },
      ],
    },
    null,
    2,
  ),
);
console.log(
  "Seeded example screenshot, invalid-file fixture, and empty/preset/interrupted-export recovery state.",
);
