# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Setu Technology** is a Next.js 15-based website and tools platform featuring:
- Multiple financial calculators (GST, Income Tax, Loan EMI, Profit Margin, etc.)
- Product showcase pages (restaurant POS, Queue system, Retail, Clinic)
- Invoice generator tool (in development)
- Content management system with blog support
- Email integration via Resend API

The project uses **TypeScript**, **React 18**, **Tailwind CSS**, and **Next.js 15** with the App Router pattern.

## Development Setup

### Quick Start
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm lint
```

The development server runs at `http://localhost:3000`.

## Project Structure

### `/app` - Next.js App Router
- **Page routes**: Each `page.tsx` is a route (e.g., `/app/calculators/gst-calculator/page.tsx` → `/calculators/gst-calculator`)
- **API routes**: `/app/api/**/route.ts` for backend endpoints (e.g., contact form, book demo)
- **Root layout**: `/app/layout.tsx` - wraps all pages with Nav, Footer, and global SEO metadata
- **Special files**: `sitemap.ts`, `robots.ts` for SEO

### `/components` - Reusable React Components
- **Root level**: `Nav.tsx`, `Footer.tsx`, `Logo.tsx`, `PageHero.tsx`, `CtaBanner.tsx`, `Faq.tsx`
- **`calculators/`**: Reusable calculator UI components
  - `CalculatorShell.tsx` - wrapper for calculator layout (form + results side-by-side on desktop)
  - `CalculatorCard.tsx`, `SegmentedControl.tsx`, `NumberField.tsx`, `ResultStat.tsx` - UI building blocks
  - **`tools/`** - individual calculator implementations (e.g., `GstCalculatorTool.tsx`, `IncomeTaxCalculatorTool.tsx`)
- **`home/`**: Homepage-specific components
- **`motion/`**: Animation/motion-related utilities

### `/lib` - Utility Functions
- **`content.ts`**: Content management and site data retrieval
- **`format.ts`**: Formatting utilities (number formatting, currency conversion, etc.)

### `/public` - Static Assets
- Favicon, OG images, product images, brand assets
- No CDN dependency — all assets served locally

### `/content` - Content Data (likely)
- Stores structured content for pages, FAQs, blog articles (check structure as needed)

## Key Development Patterns

### Calculator Pattern (Reusable Across Tools)
The **CalculatorShell** component provides a two-column layout (form + live preview on desktop, stacked on mobile):
```tsx
<CalculatorShell title="Tax Calculator">
  <GstCalculatorTool />
</CalculatorShell>
```

Individual calculator tools:
1. Manage their own state (form inputs, results)
2. Calculate live as user types
3. Support localStorage persistence (optional)
4. Return JSX for both form and results sections

### Styling
- **Tailwind CSS** for all styling (see `tailwind.config.ts`)
- **Font**: Sora (loaded from Google Fonts in layout.tsx)
- No CSS modules or styled-components — use Tailwind classes directly
- Responsive utilities: `sm:`, `md:`, `lg:` prefixes for breakpoints

### Type Safety
- Full TypeScript strict mode enabled
- Path alias `@/*` maps to repository root (e.g., `@/components/Nav` → `./components/Nav.tsx`)

### Metadata & SEO
- Server-side metadata generation via `generateMetadata()` in each page
- Root metadata in `app/layout.tsx` with OpenGraph and Twitter cards
- JSON-LD schema support (e.g., organization schema in layout.tsx)
- Static `sitemap.ts` and `robots.ts` for crawlers

### API Routes
- Example: `/app/api/contact/route.ts` handles form submissions
- Use `server-only` for sensitive server logic
- Integrate with Resend for email (already installed)

## Invoice Generator Development

### Location
- **Page**: `app/tools/invoice-generator/page.tsx` (will be created)
- **Components**: `components/tools/InvoiceGenerator/` (organize subcomponents here)
- **Utilities**: `lib/invoice.ts` (helpers for GST calculations, formatting, PDF generation)

### Key Dependencies Already Available
- **jsPDF** + **html2canvas** - PDF generation (client-side, no server needed)
- **Lucide React** - icons for UI
- **Tailwind CSS** - styling
- **Motion** - animations if needed

### Requirements (from spec)
1. **Live preview** + editable form (desktop: side-by-side, mobile: stacked)
2. **Persistence**: localStorage auto-save, no login required
3. **Core features**:
   - Business/client details, line items (add/remove/reorder)
   - Tax calculations (GST with CGST/SGST split, multiple tax rates per line)
   - Templates (3+ visual themes with brand color customization)
   - PDF download (client-side only)
4. **GST-specific**: GSTIN field, amount in words (Indian numbering — lakh/crore), E-way bill field
5. **India-focused**: Support for UPI, WhatsApp sharing (phase 2)

### Architecture Suggestions
- Create a custom hook (`useInvoiceData`) to manage form state + localStorage persistence
- Separate concerns:
  - **Form component**: input fields and line item management
  - **Preview component**: live invoice rendering
  - **PDF export utility**: `exportInvoiceToPdf()` function
  - **Template system**: separate components for each template (Classic, Modern, Colorful)
- Use React Context or a state management pattern if state grows complex

## Common Commands

### Development
```bash
npm run dev              # Start dev server with hot reload
npm run lint            # Run ESLint
npm run build           # Build for production (checks for errors)
npm start               # Start production server (after npm run build)
```

### Testing Changes
- Open `http://localhost:3000` to view live changes (hot reload active)
- For calculator tools, test form state, calculations, mobile responsiveness
- For pages, check SEO metadata in page source and browser DevTools

## Important Notes

### No Signup/Login Required
This is a core design principle. All data is stored in `localStorage` for repeat use. No backend authentication or database for user accounts.

### Privacy by Design
- PDF export happens client-side (jsPDF/html2canvas) — invoice data never hits the server
- Email delivery (future feature) will be opt-in only, not automatic

### Mobile-First
Large share of users are on mobile, particularly in India. Always test responsive design.

### SEO is Critical
- Use H1 tags with primary keywords
- Add structured data (JSON-LD schemas) for FAQs and articles
- Internal link to related tools (e.g., GST Calculator → Invoice Generator)

## Git Workflow

- **Feature branches**: `claude/<feature-name>-<suffix>` (e.g., `claude/invoice-generator-requirements-z8qqmd`)
- **Commit messages**: Clear, descriptive (e.g., "Add invoice line item form component")
- **Push to feature branch**, then create a PR for review/merge

## Useful File Paths

| Purpose | Path |
|---------|------|
| Create new calculator page | `app/calculators/[name]/page.tsx` |
| Create new tool component | `components/calculators/tools/[ToolName]Tool.tsx` |
| Add utility function | `lib/[feature].ts` |
| Add new route | `app/[path]/page.tsx` |
| Add API endpoint | `app/api/[path]/route.ts` |

## Debugging Tips

- **TypeScript errors**: Check `npm run build` for full error messages
- **Layout shifts**: Verify Tailwind classes and responsive breakpoints
- **localStorage issues**: Open DevTools → Application → Local Storage to inspect persisted data
- **PDF export problems**: Check browser console for jsPDF/html2canvas errors; test in different browsers if needed
