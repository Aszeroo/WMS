const http = require('http');

const makeRequest = (path, method = 'GET', data = null, token = null) => {
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

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

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
    console.log('Testing Supabase data storage with authentication...');

    // First, check health (should work without auth)
    const healthResult = await makeRequest('/api/health');
    console.log(`Health check - Status: ${healthResult.statusCode}`);
    console.log(`Health check - Data:`, JSON.stringify(healthResult.data, null, 2));

    // Login as admin to get token
    console.log(`\n--- Logging in as admin ---`);
    const loginData = {
      username: 'admin',
      password: 'admin123'
    };

    const loginResult = await makeRequest('/api/auth/login', 'POST', loginData);
    console.log(`Login - Status: ${loginResult.statusCode}`);
    console.log(`Login - Data:`, JSON.stringify(loginResult.data, null, 2));

    let token = null;
    if (loginResult.statusCode === 200 && loginResult.data && loginResult.data.accessToken) {
      token = loginResult.data.accessToken;
      console.log(`\n✅ Successfully obtained auth token`);
    } else {
      console.log(`\n❌ Failed to obtain auth token`);
      // Try alternative login format
      const loginData2 = {
        identifier: 'admin',
        password: 'admin123'
      };
      const loginResult2 = await makeRequest('/api/auth/login', 'POST', loginData2);
      console.log(`Login (identifier) - Status: ${loginResult2.statusCode}`);
      console.log(`Login (identifier) - Data:`, JSON.stringify(loginResult2.data, null, 2));

      if (loginResult2.statusCode === 200 && loginResult2.data && loginResult2.data.accessToken) {
        token = loginResult2.data.accessToken;
        console.log(`\n✅ Successfully obtained auth token with identifier`);
      }
    }

    if (!token) {
      console.log(`\n❌ Cannot proceed without auth token`);
      return;
    }

    // Get existing equipment types (with auth)
    const typesBefore = await makeRequest('/api/equipment-types', 'GET', null, token);
    console.log(`\nEquipment types before - Status: ${typesBefore.statusCode}`);
    console.log(`Equipment types before - Count: ${Array.isArray(typesBefore.data) ? typesBefore.data.length : 'N/A'}`);
    if (Array.isArray(typesBefore.data)) {
      console.log(`Types:`, typesBefore.data.map(t => t.name));
    }

    // Create a new equipment type
    const newType = {
      name: `Test Type ${Date.now()}`,
      unit: 'ชิ้น',
      description: 'Test type created to verify Supabase storage'
    };

    const createResult = await makeRequest('/api/equipment-types', 'POST', newType, token);
    console.log(`\nCreate equipment type - Status: ${createResult.statusCode}`);
    console.log(`Create equipment type - Data:`, JSON.stringify(createResult.data, null, 2));

    let createdTypeId = null;
    if (createResult.statusCode === 200 || createResult.statusCode === 201) {
      createdTypeId = createResult.data.id || (createResult.data.equipmentType ? createResult.data.equipmentType.id : null);

      // Get equipment types again to see if our new type is there
      const typesAfter = await makeRequest('/api/equipment-types', 'GET', null, token);
      console.log(`\nEquipment types after - Status: ${typesAfter.statusCode}`);
      console.log(`Equipment types after - Count: ${Array.isArray(typesAfter.data) ? typesAfter.data.length : 'N/A'}`);

      // Check if our new type exists
      if (Array.isArray(typesAfter.data)) {
        const foundType = typesAfter.data.find(t => t.name === newType.name);
        if (foundType) {
          console.log(`\n✅ SUCCESS: New equipment type found in database!`);
          console.log(`Found type:`, JSON.stringify(foundType, null, 2));
          createdTypeId = foundType.id;
        } else {
          console.log(`\n❌ FAILURE: New equipment type NOT found in database`);
          console.log(`Looking for:`, newType.name);
          console.log(`Available types:`, typesAfter.data.map(t => t.name));
        }
      }
    }

    // Test creating an equipment instance
    console.log(`\n--- Testing Equipment Instance ---`);
    if (createdTypeId) {
      const newInstance = {
        serialNumber: `SN-TEST-${Date.now()}`,
        brand: 'TestBrand',
        model: 'TestModel',
        status: 'available',
        typeId: createdTypeId
      };

      const instanceResult = await makeRequest('/api/equipment-instances', 'POST', newInstance, token);
      console.log(`Create equipment instance - Status: ${instanceResult.statusCode}`);
      console.log(`Create equipment instance - Data:`, JSON.stringify(instanceResult.data, null, 2));

      if (instanceResult.statusCode === 200 || instanceResult.statusCode === 201) {
        // Get instances to verify
        const instancesAfter = await makeRequest('/api/equipment-instances', 'GET', null, token);
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
    } else {
      console.log(`\n⚠️ Skipping equipment instance test - no valid typeId`);
    }

    console.log(`\n=== Test Complete ===\n`);

  } catch (error) {
    console.error('Error during testing:', error);
  }
})();