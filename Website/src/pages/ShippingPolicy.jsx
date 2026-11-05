import { Link } from 'react-router-dom';
import PolicyLayout from '../components/PolicyLayout';
import { EmailLink, PhoneLink, WhatsAppLink } from '../components/ContactLinks';
import { POLICY_UPDATED } from '../siteInfo';

export default function ShippingPolicy() {
  return (
    <PolicyLayout title="Delivery & Installation Policy" updated={POLICY_UPDATED}>
      <p>
        This is our shipping and delivery policy. Aqua Imperial, operated by Mahesh Enterprises, Ahmednagar, rents RO
        water purifiers. We do not ship or courier anything: our own technician brings the purifier to your address
        and installs it.
      </p>

      <h2>Where we deliver</h2>
      <p>
        We deliver and install only in the cities we serve. The app shows whether the service is available at your
        address.
      </p>

      <h2>When we install</h2>
      <ul>
        <li>After you pay, you choose an installation slot in the app.</li>
        <li>We usually install within 48 hours of payment.</li>
        <li>Please make sure someone is at the address during the slot you chose.</li>
        <li>
          If installation is delayed, contact us. You can also cancel within 7 days of your payment for a full
          refund, as set out in our <Link to="/refund-policy">Cancellation &amp; Refund Policy</Link>.
        </li>
      </ul>

      <h2>Charges</h2>
      <p>Delivery and installation are included in your rent. There is no separate delivery or installation charge.</p>

      <h2>After installation</h2>
      <ul>
        <li>
          Filter replacements, servicing and repairs are included in your rent, and are carried out by our
          technicians. You can ask for service from the app (see <Link to="/warranty">Service &amp; Warranty</Link>).
        </li>
        <li>A free water-quality test is included.</li>
        <li>The purifier remains the property of Mahesh Enterprises. You must not move, open or tamper with it.</li>
      </ul>

      <h2>Pickup when you cancel</h2>
      <p>
        When your rental is cancelled, we collect the purifier from your address. After the lock-in period, pickup
        is within 72 hours of cancellation. The purifier is then given a quality inspection before your security
        deposit is refunded; see our <Link to="/refund-policy">Cancellation &amp; Refund Policy</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Call <PhoneLink />, email <EmailLink /> or message us on <WhatsAppLink />.
      </p>
    </PolicyLayout>
  );
}
