
import React from 'react';
import FactBrowser from './components/FactBrowser';

const App: React.FC = () => {
  return (
    <div className="h-screen font-sans flex flex-col">
      <FactBrowser />
    </div>
  );
};

export default App;