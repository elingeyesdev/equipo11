import React from 'react';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';

import LandingHeader  from '../components/landing/LandingHeader';
import LandingHero    from '../components/landing/LandingHero';
import LandingMap     from '../components/landing/LandingMap';
import LandingFeatures from '../components/landing/LandingFeatures';
import LandingMetrics  from '../components/landing/LandingMetrics';
import LandingWhy      from '../components/landing/LandingWhy';
import LandingSources   from '../components/landing/LandingSources';
import LandingUseCases from '../components/landing/LandingUseCases';
import LandingCTA       from '../components/landing/LandingCTA';
import LandingFooter    from '../components/landing/LandingFooter';

const LandingPage = () => {
  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingSources />
        <LandingFeatures />
        <LandingMap />
        <LandingMetrics />
        <LandingWhy />
        <LandingUseCases />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
