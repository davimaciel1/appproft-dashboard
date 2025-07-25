import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { 
  TrendingDown, 
  AlertTriangle, 
  Package, 
  RotateCcw,
  DollarSign,
  ChevronRight,
  AlertCircle,
  TrendingUp
} from 'lucide-react';

interface ProfitAnalysis {
  asin: string;
  title: string;
  sku: string;
  selling_price: number;
  units_sold: number;
  total_revenue: number;
  product_cost: number;
  total_costs: number;
  gross_profit: number;
  profit_margin: number;
  profit_per_unit: number;
  profit_status: 'hemorrhage' | 'loss' | 'danger' | 'low' | 'healthy';
  main_cost_driver: string;
  recommended_action: string;
  recommended_price: number;
  potential_savings_monthly: number;
}

interface ProfitAlert {
  id: number;
  asin: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  metrics: any;
  is_read: boolean;
  created_at: string;
}

interface StatusSummary {
  hemorrhage: { count: number; total_loss: number };
  loss: { count: number; total_loss: number };
  danger: { count: number; total_loss: number };
  healthy: { count: number; total_profit: number };
}

const ProfitLeakDetector = () => {
  const [analyses, setAnalyses] = useState<ProfitAnalysis[]>([]);
  const [alerts, setAlerts] = useState<ProfitAlert[]>([]);
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [totalMonthlyLoss, setTotalMonthlyLoss] = useState(0);

  useEffect(() => {
    fetchProfitData();
    fetchAlerts();
  }, []);

  const fetchProfitData = async () => {
    try {
      const response = await fetch('/api/profit-detector/analyses');
      const data = await response.json();
      setAnalyses(data.analyses);
      setSummary(data.summary);
      setTotalMonthlyLoss(data.totalMonthlyLoss);
    } catch (error) {
      console.error('Error fetching profit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/profit-detector/alerts/unread');
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hemorrhage': return 'bg-red-500';
      case 'loss': return 'bg-orange-500';
      case 'danger': return 'bg-yellow-500';
      case 'low': return 'bg-yellow-400';
      case 'healthy': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hemorrhage': return '🔴';
      case 'loss': return '🟠';
      case 'danger': return '🟡';
      case 'low': return '🟨';
      case 'healthy': return '🟢';
      default: return '⚪';
    }
  };

  const getCostDriverIcon = (driver: string) => {
    switch (driver) {
      case 'product_cost': return '📦';
      case 'amazon_fees': return '💰';
      case 'storage': return '🏭';
      case 'returns': return '🔄';
      default: return '❓';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const filteredAnalyses = selectedStatus === 'all' 
    ? analyses 
    : analyses.filter(a => a.profit_status === selectedStatus);

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">💸 Profit Leak Detector</h1>
          <p className="text-xl opacity-90">Stop the bleeding. Save your profits.</p>
          
          <div className="mt-6 bg-white/10 backdrop-blur rounded-lg p-6">
            <div className="text-5xl font-bold">{formatCurrency(Math.abs(totalMonthlyLoss))}</div>
            <div className="text-xl mt-2">being lost this month across all products</div>
            <Button 
              className="mt-4 bg-white text-red-600 hover:bg-gray-100"
              size="lg"
            >
              SEE PROFIT SUCKERS <ChevronRight className="ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Alert className="border-red-500 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900">Critical Alerts</AlertTitle>
            <AlertDescription className="text-red-800">
              {criticalAlerts.map((alert, index) => (
                <div key={alert.id} className="mt-2">
                  <strong>{alert.title}</strong>: {alert.message}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Status Summary Cards */}
      {summary && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card 
              className={`cursor-pointer transition-all ${selectedStatus === 'hemorrhage' ? 'ring-2 ring-red-500' : ''}`}
              onClick={() => setSelectedStatus('hemorrhage')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>🔴 Hemorrhaging</span>
                  <Badge variant="destructive">{summary.hemorrhage.count}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(Math.abs(summary.hemorrhage.total_loss))}
                </div>
                <p className="text-sm text-gray-600 mt-1">Monthly loss</p>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${selectedStatus === 'loss' ? 'ring-2 ring-orange-500' : ''}`}
              onClick={() => setSelectedStatus('loss')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>🟠 Losing Money</span>
                  <Badge className="bg-orange-500">{summary.loss.count}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(Math.abs(summary.loss.total_loss))}
                </div>
                <p className="text-sm text-gray-600 mt-1">Monthly loss</p>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${selectedStatus === 'danger' ? 'ring-2 ring-yellow-500' : ''}`}
              onClick={() => setSelectedStatus('danger')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>🟡 Danger Zone</span>
                  <Badge className="bg-yellow-500">{summary.danger.count}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(Math.abs(summary.danger.total_loss))}
                </div>
                <p className="text-sm text-gray-600 mt-1">At risk</p>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${selectedStatus === 'healthy' ? 'ring-2 ring-green-500' : ''}`}
              onClick={() => setSelectedStatus('healthy')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>🟢 Healthy</span>
                  <Badge className="bg-green-500">{summary.healthy.count}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.healthy.total_profit)}
                </div>
                <p className="text-sm text-gray-600 mt-1">Monthly profit</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Profit Analysis by Product</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedStatus('all')}
              >
                Show All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4">Product</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-right p-4">Revenue</th>
                    <th className="text-right p-4">Profit/Unit</th>
                    <th className="text-right p-4">Margin</th>
                    <th className="text-left p-4">Main Issue</th>
                    <th className="text-left p-4">Action</th>
                    <th className="text-center p-4">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyses.map((product) => (
                    <tr key={product.asin} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{product.title || product.asin}</div>
                          <div className="text-sm text-gray-500">
                            ASIN: {product.asin} | SKU: {product.sku}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={getStatusColor(product.profit_status)}>
                          {getStatusIcon(product.profit_status)} {product.profit_status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div>{formatCurrency(product.total_revenue)}</div>
                        <div className="text-sm text-gray-500">
                          {product.units_sold} units
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className={product.profit_per_unit < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                          {formatCurrency(product.profit_per_unit)}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end">
                          <span className={product.profit_margin < 0 ? 'text-red-600 font-medium' : ''}>
                            {product.profit_margin.toFixed(1)}%
                          </span>
                          <div className="ml-2 w-16">
                            <Progress 
                              value={Math.max(0, Math.min(100, product.profit_margin))} 
                              className="h-2"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center">
                          <span className="mr-2">{getCostDriverIcon(product.main_cost_driver)}</span>
                          <span className="text-sm">{product.main_cost_driver.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <div className="font-medium mb-1">{product.recommended_action}</div>
                          {product.recommended_price > 0 && (
                            <div className="text-gray-600">
                              Suggested price: {formatCurrency(product.recommended_price)}
                            </div>
                          )}
                          {product.potential_savings_monthly > 0 && (
                            <div className="text-green-600">
                              Save up to {formatCurrency(product.potential_savings_monthly)}/mo
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = `/profit-analysis/${product.asin}`}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfitLeakDetector;