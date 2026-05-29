import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { orderId, userId, barName, managerName, orderDate, distributorGroups, totalItems } = await request.json()

    const pdfDoc = await PDFDocument.create()
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const obliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    const BLACK = rgb(0.067, 0.067, 0.067)
    const GOLD = rgb(0.961, 0.722, 0)
    const GRAY = rgb(0.4, 0.4, 0.4)
    const LGRAY = rgb(0.67, 0.67, 0.67)
    const WHITE = rgb(1, 1, 1)
    const LIGHT = rgb(0.961, 0.961, 0.961)
    const GREEN = rgb(0.153, 0.314, 0.043)

    const W = 612
    const H = 792
    const MARGIN = 40

    // Calculate how many pages we need
    let totalLines = 0
    distributorGroups.forEach(group => {
      totalLines += group.lines.length + 3 // header + items + spacing
    })
    const linesPerPage = 35
    const pageCount = Math.max(1, Math.ceil((totalLines + 10) / linesPerPage))

    const pages = []
    for (let i = 0; i < pageCount; i++) {
      pages.push(pdfDoc.addPage([W, H]))
    }

    let pageIndex = 0
    let page = pages[0]
    let y = H

    const newPage = () => {
      pageIndex++
      if (pageIndex < pages.length) {
        page = pages[pageIndex]
        y = H
        drawHeader()
      }
    }

    const drawHeader = () => {
      // Black header bar
      page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: BLACK })

      // Logo — Inventory in white, Sux in gold
      page.drawText('Inventory', { x: MARGIN, y: H - 44, size: 22, font: boldFont, color: WHITE })
      const invW = boldFont.widthOfTextAtSize('Inventory', 22)
      page.drawText('Sux', { x: MARGIN + invW, y: H - 44, size: 22, font: boldFont, color: GOLD })

      // Tagline
      page.drawText('Order Confirmation', { x: W - MARGIN - regularFont.widthOfTextAtSize('Order Confirmation', 10), y: H - 44, size: 10, font: regularFont, color: LGRAY })

      // Gold accent line
      page.drawRectangle({ x: 0, y: H - 73, width: W, height: 3, color: GOLD })

      y = H - 73
    }

    // Draw header on first page
    drawHeader()

    // Order meta
    y -= 28
    page.drawText('ORDER SUMMARY', { x: MARGIN, y, size: 14, font: boldFont, color: BLACK })
    page.drawRectangle({ x: MARGIN, y: y - 4, width: 60, height: 2, color: GOLD })

    y -= 22
    const metaItems = [
      ['Bar / Restaurant:', barName],
      ['Submitted By:', managerName],
      ['Order Date:', orderDate],
      ['Order #:', orderId.slice(0, 8).toUpperCase()],
      ['Total Items:', `${totalItems} items across ${distributorGroups.length} distributor${distributorGroups.length !== 1 ? 's' : ''}`],
    ]

    metaItems.forEach(([label, value]) => {
      page.drawText(label, { x: MARGIN, y, size: 9, font: boldFont, color: LGRAY })
      page.drawText(value || '--', { x: MARGIN + 110, y, size: 9, font: regularFont, color: BLACK })
      y -= 14
    })

    // Divider
    y -= 8
    page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    y -= 16

    // Distributor sections
    distributorGroups.forEach((group) => {
      if (y < 120) newPage()

      // Distributor header
      page.drawRectangle({ x: MARGIN, y: y - 18, width: W - MARGIN * 2, height: 20, color: BLACK })
      page.drawText(group.name, { x: MARGIN + 8, y: y - 13, size: 10, font: boldFont, color: WHITE })

      if (group.email) {
        const emailW = regularFont.widthOfTextAtSize(group.email, 8)
        page.drawText(group.email, { x: W - MARGIN - emailW - 8, y: y - 13, size: 8, font: regularFont, color: LGRAY })
      }

      y -= 18

      // Column headers
      page.drawRectangle({ x: MARGIN, y: y - 16, width: W - MARGIN * 2, height: 16, color: LIGHT })
      page.drawText('ITEM', { x: MARGIN + 6, y: y - 11, size: 8, font: boldFont, color: LGRAY })
      page.drawText('UNIT', { x: 380, y: y - 11, size: 8, font: boldFont, color: LGRAY })
      page.drawText('QTY', { x: W - MARGIN - 30, y: y - 11, size: 8, font: boldFont, color: LGRAY })
      y -= 16

      // Line items
      group.lines.forEach((line, idx) => {
        if (y < 60) newPage()

        const rowBg = idx % 2 === 0 ? rgb(0.99, 0.99, 0.99) : WHITE
        page.drawRectangle({ x: MARGIN, y: y - 14, width: W - MARGIN * 2, height: 14, color: rowBg })

        // Truncate long names
        let name = line.item_name || ''
        while (name.length > 0 && regularFont.widthOfTextAtSize(name, 9) > 310) {
          name = name.slice(0, -1)
        }
        if (name.length < (line.item_name || '').length) name += '...'

        page.drawText(name, { x: MARGIN + 6, y: y - 10, size: 9, font: regularFont, color: BLACK })
        page.drawText(line.unit || '--', { x: 380, y: y - 10, size: 9, font: regularFont, color: GRAY })

        const qtyStr = String(line.final_qty)
        const qtyW = boldFont.widthOfTextAtSize(qtyStr, 9)
        page.drawText(qtyStr, { x: W - MARGIN - qtyW - 4, y: y - 10, size: 9, font: boldFont, color: BLACK })

        // Row border
        page.drawLine({ start: { x: MARGIN, y: y - 14 }, end: { x: W - MARGIN, y: y - 14 }, thickness: 0.3, color: rgb(0.9, 0.9, 0.9) })
        y -= 14
      })

      // Item count summary
      y -= 4
      const summaryText = `${group.lines.length} item${group.lines.length !== 1 ? 's' : ''} ordered`
      const summaryW = regularFont.widthOfTextAtSize(summaryText, 8)
      page.drawText(summaryText, { x: W - MARGIN - summaryW, y, size: 8, font: obliqueFont, color: LGRAY })
      y -= 20
    })

    // Footer on each page
    pages.forEach((p, i) => {
      p.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: BLACK })
      p.drawRectangle({ x: 0, y: 40, width: W, height: 2, color: GOLD })
      p.drawText('inventorysux.com', { x: MARGIN, y: 14, size: 9, font: boldFont, color: WHITE })
      p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W / 2 - 20, y: 14, size: 8, font: regularFont, color: LGRAY })
      p.drawText(`Order #${orderId.slice(0, 8).toUpperCase()} · ${orderDate}`, { x: W - MARGIN - regularFont.widthOfTextAtSize(`Order #${orderId.slice(0, 8).toUpperCase()} · ${orderDate}`, 8), y: 14, size: 8, font: regularFont, color: LGRAY })
    })

    const pdfBytes = await pdfDoc.save()

    // Upload to Supabase Storage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const fileName = `${userId}/${orderId}_order.pdf`
    await supabase.storage.from('orders').upload(fileName, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true
    })

    // Update order record with pdf_url
    await supabase.from('orders').update({ pdf_url: fileName }).eq('id', orderId)

    // Generate signed URL for email attachment
    const { data: signedData } = await supabase.storage
      .from('orders')
      .createSignedUrl(fileName, 86400) // 24 hours

    return Response.json({ 
      success: true, 
      pdfUrl: signedData?.signedUrl,
      fileName 
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}