# PEA Campaign Paste Schema

Paste this YAML block into the Campaign Content field. All fields are case-sensitive.

```yaml
slug: cl-648m
prospect_name: Claudia Lozano
address: 648 Munich Lane, Palm Bay, FL 32905
agent: William Whipple
headline: Your neighbor just sold for $342,000.
cma_range: "$310,000–$335,000"
expiry_date: 2027-06-02
body_copy: |
  Introductory paragraph here. This is the first section (P1 card 1).

  :::

  Second section here. Use {{gallery:1}} to place the first gallery image inline.

  :::

  Third section here. {{gallery:2}} places the second gallery image.

p6_headline: Here's what that means for you, Claudia.
p6_body_copy: |
  P6 page content here.

  :::

  Second P6 section. Gallery markers also start at {{gallery:1}} for P6.
```

## Field reference

| Field | Required | Notes |
|---|---|---|
| `slug` | Yes | URL-safe identifier. Will be lowercased and hyphenated. |
| `prospect_name` | Yes | Full name — used for page-view tracking, never rendered on page. |
| `address` | Yes | Display address shown on the page. |
| `agent` | No | `William Whipple` (default) or `Lucky Whipple`. |
| `headline` | Yes | Main headline rendered on the P1 page. |
| `cma_range` | Yes | Displayed as a badge, e.g. `"$310,000–$335,000"`. Quote if it contains special chars. |
| `expiry_date` | No | YYYY-MM-DD. Defaults to one year from publish date if omitted. |
| `body_copy` | Yes | Markdown body for P1. Use `:::` on its own line to create section breaks. |
| `p6_headline` | Conditional | Required when the P6 toggle is ON. |
| `p6_body_copy` | Conditional | Required when the P6 toggle is ON. |

## Section breaks

`:::` on its own line (surrounded by blank lines) splits the body into separate
card sections on the rendered page. Each section gets its own card with rounded
corners matching the site design.

```
First section content.

:::

Second section content.

:::

Third section content.
```

## Gallery markers

`{{gallery:N}}` inserts the Nth uploaded gallery image at that point in the body
copy. N is 1-indexed and corresponds to upload order in the Gallery Images input.

```
Here is some text before the image.

{{gallery:1}}

Here is some text after the first image.

{{gallery:2}}
```

P6 gallery markers are independent — `{{gallery:1}}` in `p6_body_copy` refers to
the first P6 gallery image, not the P1 gallery.

## pub_date

`pub_date` is always set to today's date on submission. Do not include it in the
paste block.

## Slug naming convention

- P1 page: use the slug as-is, e.g. `cl-648m`
- P6 page: the tool automatically appends `-6`, e.g. `cl-648m-6`
- Live URLs: `https://bluegecko.homes/p/{slug}` and `https://bluegecko.homes/p/{slug}-6`
