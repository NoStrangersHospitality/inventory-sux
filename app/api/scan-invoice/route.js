import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const userId = formData.get('userId')
    const area = formData.get('area') || 'foh'

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type

    // Determine if PDF or image
    const isPDF = mimeType === 'application/pdf'
    const isImage = mimeType.startsWith('image/')

    if (!isPDF && !isImage) {
      return Response.json({ error: 'File must be a PDF or image' }, { status: 400 })
    }

    // Build the message content
    const content = []

    if (isImage) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64,
        }
      })
    } else {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        }
      })
    }

    content.push({
      type: 'text',
      text: `You are an expert at reading distributor and vendor invoices for bars and restaurants.

Extract all line items from this invoice and return ONLY a JSON object with no other text, no markdown, no backticks.

The JSON must follow this exact structure:
{
  "vendor": "vendor or distributor name",
  "invoice_number": "invoice number if visible",
  "invoice_date": "date in YYYY-MM-DD format if visible",
  "total_amount": 0.00,
  "line_items": [
    {
      "raw_name": "exact product name as written on invoice",
      "qty": 0,
      "unit": "unit of measure (case, bottle, lb, each, etc)",
      "unit_cost": 0.00,
      "total_cost": 0.00
    }
  ]
}

Rules:
- raw_name should be the exact text from the invoice, not cleaned up
- qty should be the number of units ordered/delivered
- unit_cost is the price per single unit
- total_cost is qty times unit_cost
- If a field is not visible, use null
- Return ONLY the JSON, nothing else`
    })

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content }]
    })

    const rawText = response.content[0].text.trim()

    // Parse the JSON response
    let invoiceData
    try {
      invoiceData = JSON.parse(rawText)
    } catch {
      // Try to extract JSON if there's any wrapping text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        invoiceData = JSON.parse(jsonMatch[0])
      } else {
        return Response.json({ error: 'Could not parse invoice data' }, { status: 500 })
      }
    }

    // Fetch user's inventory items to attempt matching
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data: inventoryItems } = await supabase
      .from('inventory_items')
      .select('id, name, unit, unit_cost')
      .eq('user_id', userId)
      .eq('area', area)

    // Attempt fuzzy matching for each line item
    const matchedItems = (invoiceData.line_items || []).map(item => {
      let bestMatch = null
      let bestScore = 0

      if (inventoryItems) {
        inventoryItems.forEach(invItem => {
          const score = similarityScore(
            item.raw_name.toLowerCase(),
            invItem.name.toLowerCase()
          )
          if (score > bestScore && score > 0.4) {
            bestScore = score
            bestMatch = invItem
          }
        })
      }

      return {
        ...item,
        matched_item_id: bestMatch?.id || null,
        matched_item_name: bestMatch?.name || null,
        match_confidence: bestScore,
        match_status: bestMatch ? (bestScore > 0.7 ? 'matched' : 'low_confidence') : 'unmatched'
      }
    })

    return Response.json({
      success: true,
      vendor: invoiceData.vendor,
      invoice_number: invoiceData.invoice_number,
      invoice_date: invoiceData.invoice_date,
      total_amount: invoiceData.total_amount,
      line_items: matchedItems
    })

  } catch (error) {
    console.error('Invoice scan error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// Simple similarity scoring function
function similarityScore(str1, str2) {
  // Exact match
  if (str1 === str2) return 1.0

  // One contains the other
  if (str1.includes(str2) || str2.includes(str1)) return 0.8

  // Word overlap scoring
  const words1 = str1.split(/\s+/).filter(w => w.length > 2)
  const words2 = str2.split(/\s+/).filter(w => w.length > 2)

  if (words1.length === 0 || words2.length === 0) return 0

  let matches = 0
  words1.forEach(w1 => {
    words2.forEach(w2 => {
      if (w1 === w2) matches += 1
      else if (w1.includes(w2) || w2.includes(w1)) matches += 0.5
    })
  })

  return matches / Math.max(words1.length, words2.length)
}