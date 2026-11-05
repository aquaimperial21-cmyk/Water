import { Link } from 'react-router-dom';
import PolicyLayout from '../components/PolicyLayout';
import { EmailLink, PhoneLink, WhatsAppLink } from '../components/ContactLinks';
import { BUSINESS, POLICY_UPDATED } from '../siteInfo';

export default function Terms() {
  return (
    <PolicyLayout title="Terms of Service" updated={POLICY_UPDATED}>
      <h2>1. About these terms</h2>
      <p>
        These terms apply to the Aqua Imperial water-purifier rental service, the Aqua Imperial Android app and
        this website. Aqua Imperial is operated by {BUSINESS.legalName} (“we”, “us”), a sole proprietorship whose
        proprietor is {BUSINESS.proprietor}, Udyam Registration No. {BUSINESS.udyam}, of {BUSINESS.address}.
      </p>
      <p>
        By creating an account, booking a purifier or making a payment, you agree to these terms and to
        our <Link to="/privacy">Privacy Policy</Link>, <Link to="/refund-policy">Cancellation &amp; Refund
        Policy</Link> and <Link to="/shipping-policy">Delivery &amp; Installation Policy</Link>.
      </p>

      <h2>2. The service</h2>
      <p>We rent RO water purifiers on a subscription, booked through the Aqua Imperial Android app. Your rent includes:</p>
      <ul>
        <li>the purifier, with delivery and installation at your address;</li>
        <li>filter replacements;</li>
        <li>servicing and repairs;</li>
        <li>a free water-quality test.</li>
      </ul>
      <p>
        Our purifiers are smart devices. They report filter health and water flow to us, and water flows only while
        your plan is active.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must be 18 or older to use the service.</li>
        <li>You sign in with your mobile number, verified by a one-time code.</li>
        <li>Please give accurate details, including the address where the purifier is to be installed.</li>
        <li>For rental security we ask for KYC details: the last 4 digits of your Aadhaar number and your PAN.</li>
      </ul>

      <h2>4. Plans and prices</h2>
      <ul>
        <li>
          Plans: Monthly (1 month), Quarterly (3 months), Half-yearly (6 months) and Annual (12 months). Longer plans
          have a lower monthly rate.
        </li>
        <li>
          Prices are shown in the app before you pay and can differ by purifier, plan length and city. The price
          shown is the full amount you pay.
        </li>
        <li>
          A month is a calendar month: a plan ends on the same date of the following month. If that month has no
          such date, the plan ends on its last day (for example, a plan that starts on 31 January ends on 28 or 29
          February).
        </li>
      </ul>

      <h2>5. Payment</h2>
      <ul>
        <li>You pay upfront, online through Razorpay, by UPI, debit or credit card, net banking or wallet.</li>
        <li>
          The amount is a refundable security deposit plus the rent for the whole plan term (monthly rate × number
          of months), minus any referral credit.
        </li>
        <li>Card, UPI and bank details are handled by Razorpay and are never stored by us.</li>
      </ul>

      <h2>6. Renewal, Recharge and Autopay</h2>
      <ul>
        <li>
          <strong>Recharge:</strong> you can use “Recharge” in the app at any time. Each recharge adds one more plan
          term from your current end date (or from the day you pay, if your plan has already ended).
        </li>
        <li>
          <strong>Reminders:</strong> we remind you 7, 3 and 1 day before your end date, by app notification, SMS
          or WhatsApp.
        </li>
        <li>
          <strong>End date:</strong> your plan runs without a break until its end date; it cannot be paused. When
          it reaches its end date, water stops until you renew.
        </li>
        <li>
          <strong>Autopay (optional):</strong> with UPI Autopay or an e-mandate, your plan renews for another term
          on each end date. You can cancel Autopay at any time from the app; this stops automatic renewals but does
          not cancel your rental.
        </li>
      </ul>

      <h2>7. Lock-in, trial and cancellation</h2>
      <ul>
        <li>The lock-in period is your first plan term.</li>
        <li>
          <strong>7-day trial:</strong> if you cancel within 7 days of your payment, we refund everything you paid
          (security deposit and rent) and then collect the purifier.
        </li>
        <li>
          Between the end of the trial and the end of the lock-in period, cancellation is not available. Contact us
          if you need an exception.
        </li>
        <li>
          After the lock-in period, you can cancel from the app. We pick up the purifier within 72 hours and refund
          the security deposit after it is picked up and passes a quality inspection. Rent already paid for the
          current term is not refunded.
        </li>
      </ul>
      <p>
        Full details, including refund timelines, are in our <Link to="/refund-policy">Cancellation &amp; Refund
        Policy</Link>.
      </p>

      <h2>8. The purifier</h2>
      <ul>
        <li>The purifier remains the property of Mahesh Enterprises at all times.</li>
        <li>
          You must not move, open or tamper with it. If something is wrong, contact us: servicing and repairs are
          included in your rent (see <Link to="/warranty">Service &amp; Warranty</Link>).
        </li>
        <li>
          Damage beyond normal wear and tear found at the inspection after pickup may be deducted from your security
          deposit.
        </li>
        <li>We collect the purifier when your rental is cancelled.</li>
      </ul>

      <h2>9. Where we operate</h2>
      <p>The service is available only in the cities we serve. The app shows whether it is available at your address.</p>

      <h2>10. Your rights under law</h2>
      <p>Nothing in these terms takes away any rights you have under Indian consumer protection law.</p>

      <h2>11. Changes to these terms</h2>
      <p>We may update these terms from time to time. The “Last updated” date at the top shows when they last changed.</p>

      <h2>12. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of India. The courts at Ahmednagar, Maharashtra have jurisdiction over
        any dispute. Please contact us first so we can try to resolve the issue.
      </p>

      <h2>13. Contact</h2>
      <p>
        Phone <PhoneLink /> · Email <EmailLink /> · <WhatsAppLink /> · More on our <Link to="/contact">Contact
        Us</Link> page.
      </p>
    </PolicyLayout>
  );
}
