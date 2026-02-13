// Run this with: npx tsx add-projects.ts
// Make sure your API is running on localhost:4000

const API_BASE = 'http://localhost:4000';

async function addProjectsObject() {
  try {
    console.log('Adding Projects object...');

    // Get a token (you'll need to be logged in)
    const token = process.env.JWT_TOKEN || 'your-jwt-token-here';
    
    if (token === 'your-jwt-token-here') {
      console.error('❌ Please set JWT_TOKEN environment variable or login first');
      console.log('\nTo get a token, login to the app and check localStorage for "auth_token"');
      process.exit(1);
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // Create Project object
    console.log('Creating Project object...');
    const objectRes = await fetch(`${API_BASE}/objects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        apiName: 'Project',
        label: 'Project',
        pluralLabel: 'Projects',
        description: 'Client projects and installations',
      }),
    });

    if (!objectRes.ok) {
      console.error('Failed to create object:', await objectRes.text());
      return;
    }

    const projectObject = await objectRes.json();
    console.log('✅ Created Project object');

    // Now you can add fields via the UI or API
    // This is a lot of fields, so the UI might be easier

    console.log('\n📝 Next steps:');
    console.log('1. Go to http://localhost:3000/object-manager');
    console.log('2. Find "Project" object');
    console.log('3. Add all the fields from your specification');
    console.log('4. Create the page layout with 7 tabs');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addProjectsObject();
