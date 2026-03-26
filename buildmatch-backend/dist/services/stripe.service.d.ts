import Stripe from 'stripe';
export declare const stripe: Stripe;
export declare function createOnboardingLink(userId: string): Promise<string>;
export declare function getOnboardingStatus(userId: string): Promise<{
    isOnboarded: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
}>;
export declare function handleAccountUpdated(account: Stripe.Account): Promise<void>;
export declare function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void>;
export declare function handleTransferCreated(transfer: Stripe.Transfer): Promise<void>;
export declare function constructWebhookEvent(payload: Buffer, sig: string): Stripe.Event;
//# sourceMappingURL=stripe.service.d.ts.map