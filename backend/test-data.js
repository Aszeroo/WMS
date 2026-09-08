const http = require('http');

const makeRequest = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
};

(async () => {
  try {
    console.log('Testing equipment types endpoint...');
    const typesResult = await makeRequest('/api/equipment-types');
    console.log(`Equipment Types - Status: ${typesResult.statusCode}`);
    console.log(`Equipment Types - Data:`, JSON.stringify(typesResult.data, null, 2));

    console.log('\nTesting equipment instances endpoint...');
    const instancesResult = await makeRequest('/api/equipment-instances');
    console.log(`Equipment Instances - Status: ${instancesResult.statusCode}`);
    console.log(`Equipment Instances - Data:`, JSON.stringify(instancesResult.data, null, 2));

    console.log('\nTesting employees endpoint...');
    const employeesResult = await makeRequest('/api/employees');
    console.log(`Employees - Status: ${employeesResult.statusCode}`);
    console.log(`Employees - Data:`, JSON.stringify(employeesResult.data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
})();