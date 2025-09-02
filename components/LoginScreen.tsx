
import React, { useState } from 'react';
import Button from './Button';
import Spinner from './Spinner';

interface LoginScreenProps {
  onConnect: (url: string, token: string) => void;
  isLoading: boolean;
  error: string | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onConnect, isLoading, error }) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && token) {
      onConnect(url, token);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-800/50 rounded-lg shadow-2xl ring-1 ring-white/10">
        <div>
          <h2 className="text-3xl font-bold text-center text-white">Connect to AWX</h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Enter your instance details to explore facts.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="awx-url" className="sr-only">AWX URL</label>
              <input
                id="awx-url"
                name="url"
                type="text"
                autoComplete="url"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-900 placeholder-gray-500 text-gray-100 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="AWX URL (e.g., https://awx.example.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="awx-token" className="sr-only">AWX Token</label>
              <input
                id="awx-token"
                name="token"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-900 placeholder-gray-500 text-gray-100 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="AWX OAuth2 Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          </div>
          
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <div>
            <Button type="submit" className="w-full" disabled={isLoading || !url || !token}>
              {isLoading && <Spinner className="w-5 h-5" />}
              {isLoading ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
