const http = require('http');

const makeRequest = (path, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        let parsedData;
        try {
          parsedData = JSON.parse(responseData);
        } catch (e) {
          parsedData = responseData;
        }
        resolve({ statusCode: res.statusCode, data: parsedData });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

(async () => {
  try {
    console.log('Testing Supabase data storage...');

    // First, check health
    const healthResult = await makeRequest('/api/health');
    console.log(`Health check - Status: ${healthResult.statusCode}`);
    console.log(`Health check - Data:`, JSON.stringify(healthResult.data, null, 2));

    // Get existing equipment types
    const typesBefore = await makeRequest('/api/equipment-types');
    console.log(`\nEquipment types before - Status: ${typesBefore.statusCode}`);
    console.log(`Equipment types before - Count: ${Array.isArray(typesBefore.data) ? typesBefore.data.length : 'N/A'}`);

    // Create a new equipment type
    const newType = {
      name: `Test Type ${Date.now()}`,
      unit: 'ชิ้น',
      description: 'Test type created to verify Supabase storage'
    };

    const createResult = await makeRequest('/api/equipment-types', 'POST', newType);
    console.log(`\nCreate equipment type - Status: ${createResult.statusCode}`);
    console.log(`Create equipment type - Data:`, JSON.stringify(createResult.data, null, 2));

    if (createResult.statusCode === 200 || createResult.statusCode === 201) {
      // Get equipment types again to see if our new type is there
      const typesAfter = await makeRequest('/api/equipment-types');
      console.log(`\nEquipment types after - Status: ${typesAfter.statusCode}`);
      console.log(`Equipment types after - Count: ${Array.isArray(typesAfter.data) ? typesAfter.data.length : 'N/A'}`);

      // Check if our new type exists
      if (Array.isArray(typesAfter.data)) {
        const foundType = typesAfter.data.find(t => t.name === newType.name);
        if (foundType) {
          console.log(`\n✅ SUCCESS: New equipment type found in database!`);
          console.log(`Found type:`, JSON.stringify(foundType, null, 2));
        } else {
          console.log(`\n❌ FAILURE: New equipment type NOT found in database`);
          console.log(`Looking for:`, newType.name);
          console.log(`Available types:`, typesAfter.data.map(t => t.name));
        }
      }
    }

    // Test creating an equipment instance
    console.log(`\n--- Testing Equipment Instance ---`);
    const newInstance = {
      serialNumber: `SN-TEST-${Date.now()}`,
      brand: 'TestBrand',
      model: 'TestModel',
      status: 'available',
      typeId: 1 // Assuming type ID 1 exists, or we should get it from the created type
    };

    // First get a valid typeId
    if (Array.isArray(typesAfter.data) && typesAfter.data.length > 0) {
      newInstance.typeId = typesAfter.data[0].id;
    }

    const instanceResult = await makeRequest('/api/equipment-instances', 'POST', newInstance);
    console.log(`Create equipment instance - Status: ${instanceResult.statusCode}`);
    console.log(`Create equipment instance - Data:`, JSON.stringify(instanceResult.data, null, 2));

    if (instanceResult.statusCode === 200 || instanceResult.statusCode === 201) {
      // Get instances to verify
      const instancesAfter = await makeRequest('/api/equipment-instances');
      console.log(`\nEquipment instances after - Status: ${instancesAfter.statusCode}`);
      console.log(`Equipment instances after - Count: ${Array.isArray(instancesAfter.data) ? instancesAfter.data.length : 'N/A'}`);

      // Check if our new instance exists
      if (Array.isArray(instancesAfter.data)) {
        const foundInstance = instancesAfter.data.find(i => i.serialNumber === newInstance.serialNumber);
        if (foundInstance) {
          console.log(`\n✅ SUCCESS: New equipment instance found in database!`);
          console.log(`Found instance:`, JSON.stringify(foundInstance, null, 2));
        } else {
          console.log(`\n❌ FAILURE: New equipment instance NOT found in database`);
          console.log(`Looking for SN:`, newInstance.serialNumber);
        }
      }
    }

    console.log(`\n=== Test Complete ===\n`);

  } catch (error) {
    console.error('Error during testing:', error);
  }
})();