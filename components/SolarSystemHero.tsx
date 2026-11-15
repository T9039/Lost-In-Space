const STARS = Array.from({ length: 70 }, (_, index) => ({
  x: (index * 197 + 41) % 1440,
  y: (index * 113 + 29) % 780,
  radius: index % 13 === 0 ? 1.7 : index % 4 === 0 ? 1.2 : 0.7,
  delay: `${(index % 9) * 0.37}s`,
}));

const PLANETS = [
  { name: "Mercury", radius: 67, size: 4, duration: 13, fill: "url(#hero-rock)" },
  { name: "Venus", radius: 102, size: 7, duration: 19, fill: "url(#hero-venus)" },
  { name: "Earth", radius: 143, size: 9, duration: 27, fill: "url(#hero-earth)" },
  { name: "Mars", radius: 187, size: 7, duration: 34, fill: "url(#hero-mars)" },
  { name: "Jupiter", radius: 252, size: 17, duration: 52, fill: "url(#hero-jupiter)" },
  { name: "Saturn", radius: 319, size: 14, duration: 68, fill: "url(#hero-saturn)" },
];

export default function SolarSystemHero() {
  const sunX = 865;
  const sunY = 362;
  return (
    <svg className="solar-hero-scene" viewBox="0 0 1440 780" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="hero-indigo-nebula"><stop stopColor="#3730a3" stopOpacity=".34"/><stop offset="1" stopColor="#3730a3" stopOpacity="0"/></radialGradient>
        <radialGradient id="hero-teal-nebula"><stop stopColor="#0e7490" stopOpacity=".28"/><stop offset="1" stopColor="#0e7490" stopOpacity="0"/></radialGradient>
        <radialGradient id="hero-sun"><stop stopColor="#fff7cf"/><stop offset=".28" stopColor="#fde68a"/><stop offset=".68" stopColor="#f59e0b"/><stop offset="1" stopColor="#ea580c"/></radialGradient>
        <radialGradient id="hero-rock"><stop stopColor="#dedbd3"/><stop offset="1" stopColor="#566270"/></radialGradient>
        <radialGradient id="hero-venus"><stop stopColor="#fde68a"/><stop offset="1" stopColor="#b45309"/></radialGradient>
        <radialGradient id="hero-earth"><stop stopColor="#dbeafe"/><stop offset=".34" stopColor="#38bdf8"/><stop offset="1" stopColor="#1e3a8a"/></radialGradient>
        <radialGradient id="hero-mars"><stop stopColor="#fdba74"/><stop offset="1" stopColor="#c2410c"/></radialGradient>
        <radialGradient id="hero-jupiter"><stop stopColor="#fef3c7"/><stop offset="1" stopColor="#a16207"/></radialGradient>
        <radialGradient id="hero-saturn"><stop stopColor="#fef3c7"/><stop offset="1" stopColor="#a16207"/></radialGradient>
        <filter id="hero-sun-glow" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="21" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="hero-object-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      <rect width="1440" height="780" fill="#060913" />
      <ellipse cx="230" cy="172" rx="520" ry="330" fill="url(#hero-indigo-nebula)" />
      <ellipse cx="1220" cy="212" rx="470" ry="345" fill="url(#hero-teal-nebula)" />
      {STARS.map((star, index) => <circle key={index} className="solar-hero-star" cx={star.x} cy={star.y} r={star.radius} style={{ animationDelay: star.delay }} />)}

      <g className="solar-hero-orbits">
        {PLANETS.map((planet) => (
          <g key={planet.name}>
            <circle cx={sunX} cy={sunY} r={planet.radius} fill="none" stroke="#b8c7d9" strokeOpacity=".18" strokeWidth="1" />
            <g>
              <animateTransform attributeName="transform" type="rotate" from={`0 ${sunX} ${sunY}`} to={`360 ${sunX} ${sunY}`} dur={`${planet.duration}s`} repeatCount="indefinite" />
              <circle cx={sunX} cy={sunY - planet.radius} r={planet.size} fill={planet.fill} filter="url(#hero-object-glow)" />
              {planet.name === "Earth" ? (
                <g>
                  <circle cx={sunX} cy={sunY - planet.radius} r="16" fill="none" stroke="#dbeafe" strokeOpacity=".28" />
                  <g>
                    <animateTransform attributeName="transform" type="rotate" from={`0 ${sunX} ${sunY - planet.radius}`} to={`360 ${sunX} ${sunY - planet.radius}`} dur="4s" repeatCount="indefinite" />
                    <circle cx={sunX} cy={sunY - planet.radius - 16} r="2.4" fill="#e2e8f0" />
                  </g>
                </g>
              ) : null}
              {planet.name === "Saturn" ? <ellipse cx={sunX} cy={sunY - planet.radius} rx="24" ry="6" fill="none" stroke="#fbbf24" strokeOpacity=".7" strokeWidth="2" transform={`rotate(-18 ${sunX} ${sunY - planet.radius})`} /> : null}
            </g>
          </g>
        ))}

        <g className="solar-hero-sun" filter="url(#hero-sun-glow)">
          <circle cx={sunX} cy={sunY} r="44" fill="#f59e0b" fillOpacity=".13" />
          <circle cx={sunX} cy={sunY} r="26" fill="url(#hero-sun)" />
          <circle cx={sunX} cy={sunY} r="35" fill="none" stroke="#fbbf24" strokeOpacity=".52" />
        </g>

        {[{ radius: 354, start: 18, seconds: 83 }, { radius: 380, start: 201, seconds: 97 }].map((beacon, index) => (
          <g key={index}>
            <circle cx={sunX} cy={sunY} r={beacon.radius} fill="none" stroke="#c084fc" strokeOpacity=".1" strokeDasharray="2 8" />
            <g>
              <animateTransform attributeName="transform" type="rotate" from={`${beacon.start} ${sunX} ${sunY}`} to={`${beacon.start + 360} ${sunX} ${sunY}`} dur={`${beacon.seconds}s`} repeatCount="indefinite" />
              <circle cx={sunX} cy={sunY - beacon.radius} r="3" fill="#c084fc" filter="url(#hero-object-glow)" />
              <path d={`M${sunX} ${sunY - beacon.radius}l-8 12m8-12 8 12`} stroke="#fbbf24" strokeOpacity=".75" strokeWidth="1.3" />
            </g>
          </g>
        ))}
      </g>

      <path d="M0 704 Q280 592 610 669 T1440 644 V780 H0Z" fill="#07121f" />
      <path d="M0 704 Q280 592 610 669 T1440 644" fill="none" stroke="#38bdf8" strokeOpacity=".5" strokeWidth="1.4" />
    </svg>
  );
}
