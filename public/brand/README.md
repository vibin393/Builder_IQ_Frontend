# Brand assets

Drop the Corman Leigh logo files here. Nothing else needs changing — the app
picks them up automatically, and falls back to a drawn SVG monogram if they are
missing, so it never shows a broken image.

## Files to add

| File | What it is | Requirements |
|---|---|---|
| `logo-mark.png` | **Required.** The circular mark on its own — no wordmark. | Square, transparent background, 512×512 or larger |
| `logo-full.png` | Optional. The complete lockup (mark + "Corman Leigh" + subtitle). | Transparent background, ~800px wide |
| `favicon.png` | Optional. Browser tab icon. | Square, 512×512 |

**SVG is better than PNG if you have it.** It stays sharp at every size and is a
fraction of the weight. To use SVG instead, change one line in
`src/components/Logo.tsx`:

```ts
const MARK_SRC = "/brand/logo-mark.svg";
```

## Where the logo appears

- Sidebar header, 32px — the main placement
- Login page, 38px
- Preloader, 30px, under the house-building animation

The wordmark and the letterspaced subtitle beside the mark are **live text**, not
part of the image. That keeps them crisp at any zoom, lets them recolour with the
theme, and means the subtitle can differ by context ("Builder platform" for staff,
"Trade portal" for subcontractors, "Homeowner portal" for buyers).

So `logo-mark.png` should be the **circle only**. If you supply a full-lockup
image with the text baked in, the text would appear twice.

## If the artwork needs different framing

The mark is rendered inside a circular clip at the size given. If your file has
built-in padding or is not square, adjust `.logo-mark` in `src/app/globals.css`
— it controls the border radius and how the image fits.
