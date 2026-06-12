import React from 'react';
import Header from '../components/landing/Header';
import Hero from '../components/landing/Hero';
import VariableGrid from '../components/landing/VariableGrid';
import Stats from '../components/landing/Stats';
import Footer from '../components/landing/Footer';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-prussian-blue font-sans selection:bg-tropical-teal selection:text-prussian-blue">
      <Header />
      <main>
        <Hero />
        <VariableGrid />
        <Stats />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
