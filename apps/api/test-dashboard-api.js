#!/usr/bin/env node
/**
 * Dashboard API Integration Test
 * Tests all dashboard endpoints
 * 
 * Usage:
 *   node test-dashboard-api.js <api_url> <auth_token>
 * 
 * Example:
 *   node test-dashboard-api.js http://localhost:4000 "eyJhbGc..."
 */

const API_URL = process.argv[2] || 'http://localhost:4000';
const AUTH_TOKEN = process.argv[3];

if (!AUTH_TOKEN) {
  console.error('Error: AUTH_TOKEN is required');
  console.log('Usage: node test-dashboard-api.js <api_url> <auth_token>');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

async function request(method, path, body = null) {
  const url = `${API_URL}${path}`;
  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`\n${method} ${path}`);
  if (body) console.log('Body:', JSON.stringify(body, null, 2));

  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type');
  const data =
    contentType && contentType.includes('application/json')
      ? await response.json()
      : await response.text();

  console.log(`Status: ${response.status}`);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return data;
}

async function runTests() {
  console.log('🧪 Dashboard API Test Suite');
  console.log(`📍 API URL: ${API_URL}`);
  console.log('━'.repeat(50));

  let dashboardId, widgetId;

  try {
    // Test 1: List dashboards (GET)
    console.log('\n✅ Test 1: List Dashboards (GET /dashboards)');
    const dashboards = await request('GET', '/dashboards');
    console.log(`Found ${dashboards.length} dashboards`);

    // Test 2: Create dashboard (POST)
    console.log('\n✅ Test 2: Create Dashboard (POST /dashboards)');
    const newDashboard = await request('POST', '/dashboards', {
      name: `Test Dashboard ${Date.now()}`,
      description: 'Integration test dashboard',
      widgets: [
        {
          type: 'vertical-bar',
          title: 'Test Widget',
          dataSource: 'accounts',
          config: { color: '#FF6B6B' },
          position: { x: 0, y: 0, w: 6, h: 3 },
        },
      ],
    });
    dashboardId = newDashboard.id;
    console.log(`Created dashboard: ${dashboardId}`);

    // Test 3: Get specific dashboard (GET)
    console.log('\n✅ Test 3: Get Dashboard (GET /dashboards/:id)');
    const dashboard = await request('GET', `/dashboards/${dashboardId}`);
    console.log(`Retrieved dashboard: ${dashboard.name}`);

    // Test 4: Update dashboard (PUT)
    console.log('\n✅ Test 4: Update Dashboard (PUT /dashboards/:id)');
    const updated = await request('PUT', `/dashboards/${dashboardId}`, {
      name: `Updated Dashboard ${Date.now()}`,
      isFavorite: true,
    });
    console.log(`Updated dashboard name to: ${updated.name}`);

    // Test 5: Get widgets (GET)
    console.log('\n✅ Test 5: List Widgets (GET /dashboards/:id/widgets)');
    const widgets = await request('GET', `/dashboards/${dashboardId}/widgets`);
    if (widgets.length > 0) {
      widgetId = widgets[0].id;
      console.log(`Found ${widgets.length} widgets, first ID: ${widgetId}`);
    }

    // Test 6: Add widget (POST)
    console.log('\n✅ Test 6: Add Widget (POST /dashboards/:id/widgets)');
    const newWidget = await request('POST', `/dashboards/${dashboardId}/widgets`, {
      type: 'line',
      title: 'New Test Widget',
      dataSource: 'contacts',
      config: { showLegend: true },
      position: { x: 6, y: 0, w: 6, h: 3 },
    });
    widgetId = newWidget.id;
    console.log(`Created widget: ${widgetId}`);

    // Test 7: Update widget (PUT)
    console.log('\n✅ Test 7: Update Widget (PUT /dashboards/:id/widgets/:widgetId)');
    const updatedWidget = await request(
      'PUT',
      `/dashboards/${dashboardId}/widgets/${widgetId}`,
      {
        title: 'Updated Widget Title',
        position: { x: 0, y: 3, w: 12, h: 3 },
      }
    );
    console.log(`Updated widget title to: ${updatedWidget.title}`);

    // Test 8: Delete widget (DELETE)
    console.log('\n✅ Test 8: Delete Widget (DELETE /dashboards/:id/widgets/:widgetId)');
    await request('DELETE', `/dashboards/${dashboardId}/widgets/${widgetId}`);
    console.log('Widget deleted successfully');

    // Test 9: Delete dashboard (DELETE)
    console.log('\n✅ Test 9: Delete Dashboard (DELETE /dashboards/:id)');
    await request('DELETE', `/dashboards/${dashboardId}`);
    console.log('Dashboard deleted successfully');

    // Test 10: Verify deletion
    console.log('\n✅ Test 10: Verify Deletion');
    try {
      await request('GET', `/dashboards/${dashboardId}`);
      console.error('❌ Dashboard should have been deleted');
      process.exit(1);
    } catch (e) {
      console.log('✓ Dashboard confirmed deleted (404)');
    }

    console.log('\n' + '━'.repeat(50));
    console.log('✨ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
