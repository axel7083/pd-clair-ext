/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
import type {
  Disposable,
  env,
  ExtensionContext,
  extensions,
  process as processApi,
  commands as commandsApi,
  provider,
  window,
  configuration as configurationAPI,
  cli as cliApi,
  navigation as navigationApi,
  containerEngine,
  TelemetryLogger,
  imageChecker,
} from '@podman-desktop/api';

import type { AsyncInit } from '../utils/async-init';

import { ImageService } from './image-service';
import { ProviderService } from './provider-service';
import { ContainerService } from './containers-service';
import { PodmanService } from './podman-service';
import { ClairService } from './clair-service';
import { Octokit } from '@octokit/rest';

interface Dependencies {
  extensionContext: ExtensionContext;
  window: typeof window;
  env: typeof env;
  extensions: typeof extensions;
  processApi: typeof processApi;
  providers: typeof provider;
  cliApi: typeof cliApi;
  commandsApi: typeof commandsApi;
  navigationApi: typeof navigationApi;
  containers: typeof containerEngine;
  configuration: typeof configurationAPI;
  imageChecker: typeof imageChecker;
}

export class MainService implements Disposable, AsyncInit {
  readonly #disposables: Disposable[] = [];
  readonly #telemetry: TelemetryLogger;

  constructor(private dependencies: Dependencies) {
    this.#telemetry = dependencies.env.createTelemetryLogger();
  }

  dispose(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
    this.#telemetry.dispose();
  }

  async init(): Promise<void> {
    // podman service
    const podman = new PodmanService({
      extensions: this.dependencies.extensions,
    });
    this.#disposables.push(podman);

    // The provider service register subscribers events for provider updates
    const providers = new ProviderService({
      providers: this.dependencies.providers,
    });
    this.#disposables.push(providers);

    const images = new ImageService({
      windowApi: this.dependencies.window,
      containers: this.dependencies.containers,
      providers: providers,
      navigation: this.dependencies.navigationApi,
      telemetry: this.#telemetry,
    });
    await images.init();
    this.#disposables.push(images);

    // containers
    const containers = new ContainerService({
      containers: this.dependencies.containers,
      providers: providers,
    });
    this.#disposables.push(containers);

    // clair service
    const clair = new ClairService({
      cliApi: this.dependencies.cliApi,
      process: this.dependencies.processApi,
      window: this.dependencies.window,
      envApi: this.dependencies.env,
      octokit: new Octokit(),
      storagePath: this.dependencies.extensionContext.storagePath,
    });
    await clair.init();
    this.#disposables.push(clair);
  }
}
