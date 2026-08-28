# Remix of Payout Perfect

Build a beautiful, premium, cute, modern and highly professional single-page Payout PDF → Excel Management Web App.

The website must be ONLY ONE PAGE. Do not create unnecessary separate pages.

MAIN PURPOSE

I want to upload 6+ payout PDF files at once. The application must automatically read, analyze and extract the useful data from every PDF and convert it into my existing Excel structure.

The uploaded PDF contains payout information such as:

Supplier name

Payout date

Payout balance

Order date

Order number

Product title

Balance / GBP amount

Base price

Fleek Commission

Discounts

Shipping where available

The application should intelligently extract the relevant information and create/update an Excel file using the same structure and calculation style as my provided Excel template.

I have provided:

A sample payout PDF to understand the actual payout format.

An Excel template to understand EXACTLY how the final downloaded Excel should look.

Use those files as the source of truth for the data structure and formatting.

PDF UPLOAD

Create a premium drag-and-drop PDF upload area.

Requirements:

Allow 6+ PDFs in a single upload.

Multiple file selection.

Drag & drop support.

Show uploaded files as beautiful cards.

Show PDF filename.

Show processing status.

Show success/error state.

Allow removing individual files before processing.

Add a large professional "Process Payouts" button.

The UI should feel extremely smooth and polished.

PDF DATA EXTRACTION

When the user clicks "Process Payouts":

Read every uploaded PDF.

Extract all payout/order records.

Detect the supplier.

Detect payout date.

Detect order date.

Detect order number.

Detect product name/title.

Detect payout/balance amount in GBP.

Detect base price where available.

Detect commission where available.

Detect discount where available.

Detect shipping where available.

Detect quantity/PCS if the product description contains it.

Preserve product names accurately.

Do NOT accidentally duplicate the same order because the PDF contains summary information and detailed order information.

Each order should appear ONLY ONCE in the final Excel.

Use order number + payout information as an important uniqueness key.

If the same order appears multiple times inside a PDF because of PDF formatting, deduplicate it.

If an order is genuinely present in two different payout files, handle it intelligently and prevent accidental duplication.

Never silently invent missing information.

If a field is not available in the PDF, leave it blank rather than guessing.

EXCEL STRUCTURE

The downloaded Excel should follow the provided template's structure.

Use these columns:

S NO. DATE CATEGORY ORDER PRODUCT NAME QUANTITY (PCS) WEIGHT (KGS) GBP AMOUNT by Fleek AVG RATE USD AMOUNT PACKAGES DIMENSIONS (C.M) COUNTRY

Maintain the same professional Excel layout as the provided template.

IMPORTANT CALCULATIONS

The Excel should preserve the calculation behavior of the provided template.

For USD AMOUNT:

USD AMOUNT = GBP AMOUNT by Fleek × AVG RATE

Use Excel formulas instead of hardcoded USD values wherever possible.

For example:

=I5*J5

The AVG RATE should follow the value/logic used by the existing Excel template unless the user changes it.

The final Excel must contain proper formulas so that calculations automatically update when values are changed.

TOTALS

At the bottom of the Excel, automatically calculate totals for relevant numeric columns.

Use Excel formulas such as:

SUBTOTAL

The total row should automatically expand as new payout records are added.

At minimum calculate totals for:

Quantity (PCS)

Weight (KGS)

GBP Amount

USD Amount

Packages

The final Excel must remain fully editable.

PERSISTENT MASTER DATA

This is VERY IMPORTANT.

The application must maintain a persistent master payout dataset.

When I upload my first batch of PDFs:

PDF DATA → MASTER DATA → EXCEL

When I later upload another payout PDF:

NEW PDF DATA → ADD ONLY NEW RECORDS → EXISTING MASTER DATA

Do NOT replace or delete the previous data.

Example:

First upload: 6 PDFs → 100 records

Later upload: 2 new PDFs → 25 new records

Final master dataset: 125 records

The previous 100 records MUST remain.

Only genuinely new records should be added.

DUPLICATE PROTECTION

Create a robust duplicate detection system.

Use a unique record identity based primarily on:

Order number

Order date

Supplier

Product name / relevant payout information

If an order has already been imported, do not import it again.

Show a small processing summary:

Imported: 25 Already existed: 8 Skipped duplicates: 8 Errors: 0

DATA STORAGE

The master payout data must remain saved even after:

Page refresh

Browser refresh

Closing and reopening the website

Do NOT make the user re-upload all previous PDFs every time.

Use reliable browser-side persistent storage such as IndexedDB/local database for the master dataset.

Store:

All extracted records

Supplier

Dates

Orders

Product names

GBP amounts

Calculated values

Import history

Unique record IDs

The data should remain until the user explicitly chooses to clear/reset it.

Add a clearly protected:

"Clear All Data"

button with confirmation.

DASHBOARD

At the top of the single page, create a beautiful mini dashboard showing:

Total Records Total GBP Total USD Total Quantity Total Packages PDFs Imported

These numbers should update automatically whenever new PDFs are processed.

Also show: "Last Updated"

DATA TABLE

Below the dashboard, create a beautiful responsive data table showing all imported payout records.

Columns should match the Excel structure.

Features:

Search

Filter by supplier

Filter by date

Filter by category

Sort by date

Sort by amount

Pagination if needed

Sticky table header

Horizontal scrolling on mobile

Clean empty states

The table should update instantly when new PDFs are imported.

EXCEL DOWNLOAD

Create a premium:

"Download Excel"

button.

When clicked, generate a real .xlsx file.

The downloaded Excel must:

Follow the provided Excel template structure

Contain ALL previous records

Include newly imported records

Maintain S NO. sequentially

Include formulas

Include totals

Maintain professional formatting

Preserve date formatting

Preserve GBP/USD number formatting

Freeze the header row

Use filters

Auto-size columns appropriately

Keep the workbook editable

IMPORTANT:

Downloading Excel must NOT clear the website's stored data.

The next payout upload must continue adding to the same master dataset.

CATEGORY LOGIC

The application should intelligently determine CATEGORY from the product name where possible, following the style of the existing Excel template.

For example:

Y2K

VINTAGE

If category cannot be confidently determined, leave it blank or mark it appropriately rather than inventing data.

QUANTITY

If the product title contains information such as: "85 pcs" "mixed 85 pcs"

extract the quantity as 85.

Otherwise leave quantity blank unless the PDF explicitly provides it.

COUNTRY / WEIGHT / PACKAGES / DIMENSIONS

These fields may not always exist in the payout PDF.

Do NOT fabricate these values.

If they are unavailable:

Leave blank

Keep the Excel structure intact

If they are available from a future PDF format, automatically extract them.

BEAUTIFUL UI / DESIGN

The website must look like a premium SaaS product.

Color direction:

Background: WHITE

Main buttons: BLACK

Text: BLACK / dark neutral

Subtle gray borders

Very light gray backgrounds for secondary sections

Minimal accent colors only where needed

Do NOT make the website colorful or childish.

Make it:

Cute

Elegant

Premium

Professional

Clean

Modern

High-end

Smooth

HERO SECTION

At the top:

Small badge: "PAYOUT MANAGEMENT"

Large headline:

"Turn Payout PDFs Into Your Perfect Excel"

Subtitle:

"Upload multiple payout files, automatically extract your orders and keep your master payout data organized in one place."

Then show the beautiful PDF upload/dropzone.

Add a subtle animated background effect, but keep the overall background white.

ANIMATIONS

Use high-quality smooth animations:

Page entrance animation

Card fade/slide animations

Upload hover animation

Drag-over animation

Button micro-interactions

Processing progress animation

Table row transitions

Dashboard number animations

Smooth scrolling

Subtle hover effects

Animations must be fast and professional, not excessive.

PROCESSING EXPERIENCE

When PDFs are being processed, show a beautiful processing modal/card:

"Analyzing your payout files..."

Then show progress such as:

Reading PDFs Extracting orders Cleaning product names Removing duplicates Calculating totals Preparing your Excel

Show progress percentage.

Do not freeze the UI.

ERROR HANDLING

If a PDF cannot be processed:

Show: "Could not process this file"

with the filename and reason.

Do not lose successfully processed files.

Allow the user to continue with the valid PDFs.

RESPONSIVE DESIGN

The entire website must work perfectly on:

Desktop

Laptop

Tablet

Mobile

On mobile:

Upload area should fit the screen

Dashboard cards should stack beautifully

Table should support horizontal scrolling

Buttons should be easy to tap

No horizontal page overflow

Typography should remain beautiful

IMPORTANT DATA SAFETY RULE

Never delete existing master records simply because the user uploaded new PDFs.

Never replace the master dataset.

Always:

EXISTING DATA + NEW UNIQUE PAYOUT DATA = UPDATED MASTER DATA

Only remove data if the user explicitly clicks "Clear All Data" and confirms it.

EXCEL TEMPLATE FIDELITY

Study the provided Excel template carefully and reproduce its:

Column order

Header naming

Formula behavior

Total-row behavior

Number formatting

Date formatting

Overall professional structure

Do NOT create a completely different Excel format.

The goal is that the downloaded Excel feels like the same workbook/template, just automatically populated and updated with new payout data.

TECHNICAL REQUIREMENTS

Build this as a real functional application, not a static mockup.

Use:

PDF text extraction/parsing

XLSX generation

IndexedDB for persistent browser storage

Proper duplicate detection

Real Excel formulas

Client-side processing where possible

Clean component architecture

Strong error handling

Responsive UI

Do not use fake demo data in the final application.

The application must work with real uploaded PDF files.

FINAL USER FLOW

The final experience should be:

Open website

See beautiful dashboard

Upload 6+ payout PDFs

Click "Process Payouts"

PDFs are analyzed

Orders are extracted

Duplicate orders are removed

New records are added to existing master data

Dashboard totals update

Data appears in the table

User clicks "Download Excel"

A professional XLSX file downloads

Excel contains ALL old + new records

Excel contains formulas and totals

Website data remains saved

Next time the user uploads new payouts, they are automatically appended to the same master dataset

Make the final website feel like a $10,000+ premium SaaS dashboard: extremely polished, fast, elegant, cute, professional, and production-ready.

Most importantly: prioritize data accuracy, duplicate prevention, persistent storage, correct Excel calculations, and exact template-style output over visual effects.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://yourpayouts.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e081c1e6-7397-4057-99e6-da4b79c28066).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
