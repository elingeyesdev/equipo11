import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-prussian-blue border-t border-dusk-blue py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <span className="text-xl font-bold text-white tracking-tight">
              Enviro<span className="text-tropical-teal">Sense</span>
            </span>
            <p className="text-gray-400 text-sm mt-1">© {new Date().getFullYear()} Todos los derechos reservados.</p>
          </div>
          <div className="flex space-x-6 text-sm text-gray-400">
            <a href="#" className="hover:text-tropical-teal transition-colors">Política de Privacidad</a>
            <a href="#" className="hover:text-tropical-teal transition-colors">Términos de Servicio</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
