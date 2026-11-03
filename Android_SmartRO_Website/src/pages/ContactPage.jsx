import { Link } from 'react-router-dom';
import PolicyLayout from '../components/PolicyLayout';
import Contact from '../components/Contact';
import { EmailLink, PhoneLink, WhatsAppLink } from '../components/ContactLinks';
import { BUSINESS, PHONE_DISPLAY } from '../siteInfo';

export default function ContactPage() {
  return (
    <PolicyLayout
      title="Contact Us"
      intro="Questions about plans, payments, refunds, installation or service? Call, WhatsApp or email us."
      extra={<Contact />}
    >
      <h2>Reach us</h2>
      <dl>
        <dt>Phone</dt>
        <dd><PhoneLink /></dd>
        <dt>WhatsApp</dt>
        <dd><WhatsAppLink text="Hi Aqua Imperial!">{PHONE_DISPLAY}</WhatsAppLink></dd>
        <dt>Email</dt>
        <dd><EmailLink /></dd>
        <dt>Address</dt>
        <dd>
          <address>
            {BUSINESS.legalName}
            {BUSINESS.addressLines.map((line) => <span key={line}><br />{line}</span>)}
          </address>
        </dd>
      </dl>

      <h2>Business details</h2>
      <dl>
        <dt>Legal name</dt>
        <dd>{BUSINESS.legalName} (sole proprietorship)</dd>
        <dt>Proprietor</dt>
        <dd>{BUSINESS.proprietor}</dd>
        <dt>Udyam Reg. No.</dt>
        <dd>{BUSINESS.udyam} (registered MSME)</dd>
        <dt>Brand</dt>
        <dd>{BUSINESS.brand}</dd>
        <dt>Business</dt>
        <dd>RO water purifiers on rent; sales, service and spare parts for all types of water purifiers since 2011</dd>
      </dl>

      <h2>Existing customers</h2>
      <p>
        If you already rent a purifier from us, you can ask for service, recharge, pause or cancel your plan from the
        Aqua Imperial app. For a payment or refund question, please give your registered mobile number and, if you
        have it, the Razorpay payment ID. See also our <Link to="/refund-policy">Cancellation &amp; Refund
        Policy</Link> and <Link to="/warranty">Service &amp; Warranty</Link>.
      </p>
    </PolicyLayout>
  );
}
