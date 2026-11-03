import { Link } from 'react-router-dom';
import PolicyLayout from '../components/PolicyLayout';
import { EmailLink, PhoneLink, WhatsAppLink } from '../components/ContactLinks';
import { POLICY_UPDATED } from '../siteInfo';

export default function RefundPolicy() {
  return (
    <PolicyLayout title="Cancellation & Refund Policy" updated={POLICY_UPDATED}>
      <p>
        This policy explains when you can cancel your Aqua Imperial water-purifier rental and how refunds are paid.
        Aqua Imperial is operated by Mahesh Enterprises, Ahmednagar, Maharashtra.
      </p>

      <h2>What you pay</h2>
      <p>
        When you book, you pay upfront, online through Razorpay: a refundable security deposit plus the rent for the
        whole plan term (monthly rate × number of months), minus any referral credit you have.
      </p>

      <h2>Two periods to know</h2>
      <ul>
        <li><strong>Trial:</strong> the first 7 days after your payment.</li>
        <li>
          <strong>Lock-in:</strong> your first plan term — 1, 3, 6 or 12 months, depending on the plan you chose.
        </li>
      </ul>

      <h2>When you can cancel</h2>

      <h3>1. Within the 7-day trial: full refund</h3>
      <p>
        Cancel within 7 days of your payment and we refund everything you paid: the security deposit and the rent.
        We then collect the purifier from your address.
      </p>

      <h3>2. After the trial, until lock-in ends: cancellation not available</h3>
      <p>
        Between the end of the trial and the end of your first plan term, the rental cannot be cancelled; your plan
        runs until its end date. If you have a special situation, contact us to ask for an exception.
      </p>

      <h3>3. After lock-in ends: security deposit refunded</h3>
      <p>
        Cancel from the app. We pick up the purifier within 72 hours. Once it has been picked up and passes a
        quality inspection, we refund your security deposit. Rent already paid for the current term is not
        refunded.
      </p>

      <h2>Deductions from the deposit</h2>
      <p>We deduct from the security deposit only for damage beyond normal wear and tear found at the inspection.</p>

      <h2>Autopay</h2>
      <p>
        Cancelling your rental also cancels Autopay. You can turn off Autopay any time from the app; that stops
        automatic renewals but does not cancel your rental.
      </p>

      <h2>Failed or duplicate payments</h2>
      <p>
        If money is deducted from your account but your booking or recharge is not confirmed, or you are charged
        twice for the same payment, we refund the amount to your original payment method.
      </p>

      <h2>How refunds are paid</h2>
      <ul>
        <li>
          Every refund goes back to the original payment method (UPI, card, net banking or wallet) through Razorpay.
        </li>
        <li>
          Refunds are issued within 5–7 working days of approval or, for a security deposit, of the purifier being
          picked up.
        </li>
        <li>Your bank may take a few more days to show the money in your account.</li>
      </ul>

      <h2>Questions about a refund</h2>
      <p>
        Call <PhoneLink />, email <EmailLink /> or message us on <WhatsAppLink />. Please give your registered mobile
        number and, if you have it, the Razorpay payment ID, so we can find your payment quickly.
      </p>
      <p>
        See also our <Link to="/terms">Terms of Service</Link> and <Link to="/shipping-policy">Delivery &amp;
        Installation Policy</Link>.
      </p>
    </PolicyLayout>
  );
}
