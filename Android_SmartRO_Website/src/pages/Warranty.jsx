import { Link } from 'react-router-dom';
import PolicyLayout from '../components/PolicyLayout';
import { EmailLink, PhoneLink, WhatsAppLink } from '../components/ContactLinks';
import { POLICY_UPDATED } from '../siteInfo';

export default function Warranty() {
  return (
    <PolicyLayout title="Service & Warranty" updated={POLICY_UPDATED}>
      <h2>Covered for the whole rental</h2>
      <p>
        When you rent an Aqua Imperial purifier, it stays the property of Mahesh Enterprises, so looking after it is
        our job. For the whole time you rent it, all of the following are included, at no extra charge:
      </p>
      <ul>
        <li>repairs;</li>
        <li>spare parts;</li>
        <li>filter changes;</li>
        <li>service visits by our technicians.</li>
      </ul>

      <h2>What is not covered</h2>
      <p>
        Damage caused by misuse of the purifier, or by tampering with it (for example moving, opening or modifying
        it yourself), is not covered. Damage beyond normal wear and tear found at the inspection after pickup may be
        deducted from your security deposit, as set out in our <Link to="/terms">Terms of Service</Link>.
      </p>

      <h2>How to raise a service request</h2>
      <ul>
        <li><strong>In the app:</strong> raise a service ticket from the Aqua Imperial app.</li>
        <li><strong>By phone:</strong> call <PhoneLink />.</li>
        <li>
          <strong>On WhatsApp:</strong> message us on{' '}
          <WhatsAppLink text="Hi Aqua Imperial, I need service for my purifier.">WhatsApp</WhatsAppLink>.
        </li>
      </ul>
      <p>
        Please give your registered mobile number so we can find your purifier quickly. You can also email us
        at <EmailLink />.
      </p>
    </PolicyLayout>
  );
}
