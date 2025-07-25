import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Plus, 
  RefreshCw,
  AlertCircle,
  Trophy,
  Star
} from 'lucide-react';

interface Competitor {
  id: number;
  our_asin: string;
  our_product: string;
  competitor_asin: string;
  competitor_brand: string;
  competition_level: string;
  our_price: number;
  competitor_price: number;
  price_difference: number;
  price_difference_percent: number;
  price_position: string;
  our_rank: number;
  competitor_rank: number;
  our_rating: number;
  competitor_rating: number;
  monitoring_date: string;
}

interface BrandOwner {
  id: number;
  seller_id: string;
  brand_name: string;
  is_exclusive: boolean;
}

export default function BrandOwnerDashboard() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [brandOwner, setBrandOwner] = useState<BrandOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({
    ourAsin: '',
    competitorAsin: '',
    competitorBrand: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Buscar dados do brand owner
      const brandResponse = await fetch('/api/brand-owner/info');
      if (brandResponse.ok) {
        const brandData = await brandResponse.json();
        setBrandOwner(brandData);
      }
      
      // Buscar competidores
      const response = await fetch('/api/brand-owner/competitors');
      if (response.ok) {
        const data = await response.json();
        setCompetitors(data);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCompetitor = async () => {
    try {
      const response = await fetch('/api/brand-owner/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompetitor)
      });
      
      if (response.ok) {
        setShowAddForm(false);
        setNewCompetitor({ ourAsin: '', competitorAsin: '', competitorBrand: '', notes: '' });
        fetchData();
      }
    } catch (error) {
      console.error('Erro ao adicionar competidor:', error);
    }
  };

  const monitorCompetitors = async () => {
    try {
      const response = await fetch('/api/brand-owner/monitor', {
        method: 'POST'
      });
      
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Erro ao monitorar:', error);
    }
  };

  const getPriceIcon = (position: string) => {
    switch (position) {
      case 'Vantagem':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      case 'Desvantagem':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriceBadge = (percent: number) => {
    if (percent < -10) return <Badge className="bg-green-500">Vantagem {Math.abs(percent).toFixed(1)}%</Badge>;
    if (percent > 10) return <Badge variant="destructive">Desvantagem {percent.toFixed(1)}%</Badge>;
    return <Badge variant="secondary">Empate</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard de Competidores - Brand Owner</h1>
        {brandOwner && (
          <p className="text-gray-600">
            Marca: <span className="font-semibold">{brandOwner.brand_name}</span> | 
            Seller ID: <span className="font-mono text-sm">{brandOwner.seller_id}</span>
          </p>
        )}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Competidores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competitors.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Com Vantagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {competitors.filter(c => c.price_position === 'Vantagem').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Com Desvantagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {competitors.filter(c => c.price_position === 'Desvantagem').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Última Atualização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {competitors[0]?.monitoring_date 
                ? new Date(competitors[0].monitoring_date).toLocaleString('pt-BR')
                : 'Nunca'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-4 mb-6">
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Competidor
        </Button>
        <Button variant="outline" onClick={monitorCompetitors}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar Preços
        </Button>
      </div>

      {/* Formulário de Adicionar Competidor */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Adicionar Novo Competidor</CardTitle>
            <CardDescription>
              Defina manualmente qual ASIN compete com seu produto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Seu ASIN</Label>
                <Input
                  value={newCompetitor.ourAsin}
                  onChange={(e) => setNewCompetitor({...newCompetitor, ourAsin: e.target.value})}
                  placeholder="B0ABC123"
                />
              </div>
              <div>
                <Label>ASIN do Competidor</Label>
                <Input
                  value={newCompetitor.competitorAsin}
                  onChange={(e) => setNewCompetitor({...newCompetitor, competitorAsin: e.target.value})}
                  placeholder="B0XYZ789"
                />
              </div>
              <div>
                <Label>Marca do Competidor</Label>
                <Input
                  value={newCompetitor.competitorBrand}
                  onChange={(e) => setNewCompetitor({...newCompetitor, competitorBrand: e.target.value})}
                  placeholder="Marca Concorrente"
                />
              </div>
              <div>
                <Label>Notas (opcional)</Label>
                <Input
                  value={newCompetitor.notes}
                  onChange={(e) => setNewCompetitor({...newCompetitor, notes: e.target.value})}
                  placeholder="Principal competidor na categoria"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={addCompetitor}>Adicionar</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Competidores */}
      {competitors.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum competidor definido ainda. Clique em "Adicionar Competidor" para começar.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {competitors.map((competitor) => (
            <Card key={competitor.id}>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Informações do Produto */}
                  <div>
                    <h3 className="font-semibold mb-2">Nosso Produto</h3>
                    <p className="text-sm text-gray-600 mb-1">{competitor.our_asin}</p>
                    <p className="text-sm">{competitor.our_product || 'Nome não disponível'}</p>
                  </div>

                  {/* Informações do Competidor */}
                  <div>
                    <h3 className="font-semibold mb-2">Competidor</h3>
                    <p className="text-sm text-gray-600 mb-1">{competitor.competitor_asin}</p>
                    <p className="text-sm">{competitor.competitor_brand}</p>
                  </div>

                  {/* Comparação de Preços */}
                  <div>
                    <h3 className="font-semibold mb-2">Análise de Preços</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Nosso:</span>
                        <span className="font-semibold">
                          R$ {competitor.our_price?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Deles:</span>
                        <span className="font-semibold">
                          R$ {competitor.competitor_price?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPriceIcon(competitor.price_position)}
                        {getPriceBadge(competitor.price_difference_percent || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Rankings e Avaliações */}
                  <div>
                    <h3 className="font-semibold mb-2">Métricas</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          Ranking: {competitor.our_rank || 'N/A'} vs {competitor.competitor_rank || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm">
                          Avaliação: {competitor.our_rating || '0'} vs {competitor.competitor_rating || '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}