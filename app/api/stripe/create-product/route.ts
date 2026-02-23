import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripeServer } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { eventId, title, priceAmount, groupName } = body

  if (!eventId || !title || !priceAmount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const stripe = getStripeServer()
    const product = await stripe.products.create({
      name: title,
      description: `Event ticket — ${groupName}`,
      metadata: { event_id: eventId, group_name: groupName },
    })

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(priceAmount * 100),
      currency: 'gbp',
    })

    const serviceClient = createServiceClient()
    await serviceClient
      .from('events')
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      })
      .eq('id', eventId)

    return NextResponse.json({ productId: product.id, priceId: price.id })
  } catch (err) {
    console.error('[stripe/create-product] error:', err)
    return NextResponse.json(
      { error: 'Failed to create Stripe product' },
      { status: 500 }
    )
  }
}
