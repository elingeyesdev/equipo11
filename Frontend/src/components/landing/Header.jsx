import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="fixed w-full top-0 z-50 bg-space-indigo/80 backdrop-blur-md border-b border-dusk-blue">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl font-bold text-white tracking-tight">
              Enviro<span className="text-tropical-teal">Sense</span>
            </Link>
          </div>
          <nav className="hidden md:flex space-x-8">
            <Link to="/mapa" className="text-gray-300 hover:text-white transition-colors duration-200">
              Mapa
            </Link>
            <a href="#variables" className="text-gray-300 hover:text-white transition-colors duration-200">
              Variables
            </a>
          </nav>
          <div className="flex items-center">
            <Link
              to="/login"
              className="px-4 py-2 rounded-md bg-transparent border border-tropical-teal text-tropical-teal hover:bg-tropical-teal hover:text-prussian-blue transition-all duration-300 font-medium"
            >
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
