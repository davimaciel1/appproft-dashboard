import React, { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface LoginProps {
  setIsAuthenticated: (value: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ setIsAuthenticated }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const data = isLogin ? { email, password } : { email, password, name };
      
      console.log('Tentando login em:', endpoint);
      const response = await api.post(endpoint, data);
      
      localStorage.setItem('token', response.data.token);
      setIsAuthenticated(true);
      toast.success(isLogin ? 'Login realizado com sucesso!' : 'Cadastro realizado com sucesso!');
      
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('Erro no login:', error);
      if (error.response) {
        toast.error(error.response.data.error || 'Erro ao autenticar');
      } else if (error.request) {
        toast.error('Erro de conexão com o servidor');
      } else {
        toast.error('Erro ao processar requisição');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary-orange">AppProft</h1>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              {isLogin ? 'Cadastrar' : 'Entrar'}
            </button>
          </div>
        </div>
      </header>

      <section className="py-20">
        <div className="container mx-auto px-4 max-w-md">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}
            </h2>
            <p className="text-gray-600">
              {isLogin 
                ? 'Faça login para acessar seu dashboard' 
                : 'Comece a monitorar suas vendas agora'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-card">
            {!isLogin && (
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-orange"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-orange"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-orange"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-orange text-white font-semibold py-3 px-4 rounded-lg hover:shadow-hover disabled:opacity-50"
            >
              {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
            </button>
          </form>

          <p className="text-center mt-6 text-gray-600">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary-orange font-medium hover:underline"
            >
              {isLogin ? 'Cadastre-se' : 'Faça login'}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
};

export default Login;