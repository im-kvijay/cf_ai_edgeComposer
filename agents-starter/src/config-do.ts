import { DurableObject } from "cloudflare:workers";

/**
 * Configuration Management Durable Object
 * Simple version for demo purposes
 */

interface ConfigVersion {
  id: string;
  config: any;
  description: string;
  createdAt: string;
}

export class ConfigDO extends DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle preview requests
    if (url.pathname.startsWith('/preview/')) {
      return this.handlePreview(request);
    }

    const method = request.method;
    const path = url.pathname;

    switch (method) {
      case 'GET':
        if (path === '/versions') return this.getVersions();
        if (path === '/active') return this.getActive();
        break;

      case 'POST':
        if (path === '/save') return this.saveVersion(await request.json());
        break;
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handlePreview(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const token = pathParts[2];

    if (!token) {
      return new Response('Missing preview token', { status: 400 });
    }

    // For demo, just return a simple preview response
    return new Response(`
      <html>
        <head><title>CDN Preview</title></head>
        <body style="font-family: system-ui, sans-serif; padding: 20px;">
          <h1>CDN Configuration Preview</h1>
          <p>This is a preview of how the CDN configuration would be applied.</p>
          <p><strong>Token:</strong> ${token}</p>
          <p><strong>Path:</strong> ${url.pathname}</p>
          <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 4px;">
            <strong>Preview Mode Active</strong><br>
            Route: v1<br>
            Cache Status: HIT<br>
            Response Time: ~85ms
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  private async getVersions(): Promise<Response> {
    const versions = await this.state.storage.list({ prefix: 'version:' });
    const versionList: ConfigVersion[] = [];

    for (const [, value] of versions) {
      if (value) {
        versionList.push(value as ConfigVersion);
      }
    }

    return Response.json({
      versions: versionList.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    });
  }

  private async getActive(): Promise<Response> {
    const active = await this.state.storage.get<ConfigVersion>('active');
    return Response.json({ active });
  }

  private async saveVersion(data: {
    config: any;
    description: string;
  }): Promise<Response> {
    const versionId = crypto.randomUUID();

    const version: ConfigVersion = {
      id: versionId,
      config: data.config,
      description: data.description,
      createdAt: new Date().toISOString()
    };

    await this.state.storage.put(`version:${versionId}`, version);
    await this.state.storage.put('active', version);

    return Response.json({
      version,
      message: 'Configuration saved successfully'
    });
  }
}
