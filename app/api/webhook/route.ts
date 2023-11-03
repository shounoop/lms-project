import Stripe from 'stripe';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: Request) {
	const body = await req.text();

	// this means that the request is coming from Stripe and not from a user on our site (i.e. a hacker)
	const signature = headers().get('Stripe-Signature') as string;

	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(
			body,
			signature,
			process.env.STRIPE_WEBHOOK_SECRET!
		);
	} catch (error: any) {
		return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
	}

	const session = event.data.object as Stripe.Checkout.Session;
	const userId = session?.metadata?.userId;
	const courseId = session?.metadata?.courseId;

	if (event.type === 'checkout.session.completed') {
		if (!userId || !courseId) {
			return new NextResponse('Unauthorized', { status: 401 });
		}

		await db.purchase.create({
			data: {
				courseId,
				userId,
			},
		});
	} else {
		return new NextResponse(
			`Webhook Error: Unhandled event type: ${event.type}`,
			{ status: 200 }
		);
	}

	return new NextResponse('Webhook received', { status: 200 });
}