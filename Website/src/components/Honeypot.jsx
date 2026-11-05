// A spam trap: a "website" field real visitors never see or reach, so it stays
// empty. Bots that fill in every input give themselves away to the server.
export default function Honeypot({ value, onChange }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', left: '-10000px', top: 0,
        width: '1px', height: '1px', overflow: 'hidden', opacity: 0,
      }}
    >
      <label>
        Website
        <input
          type="text"
          name="website"
          value={value}
          onChange={onChange}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
      </label>
    </div>
  );
}
