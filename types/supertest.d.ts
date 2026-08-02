declare module 'supertest' {
  import type { Application } from 'express';

  export interface TestResponse {
    body: unknown;
  }

  export type ExpectCallback = (response: TestResponse) => void;

  export interface TestRequest {
    set(field: string, value: string): TestRequest;
    send(body: unknown): TestRequest;
    expect(status: number): TestRequest;
    expect(callback: ExpectCallback): Promise<TestResponse>;
    expect(status: number, callback: ExpectCallback): Promise<TestResponse>;
    then<TResult1 = TestResponse, TResult2 = never>(
      onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2>;
  }

  export interface SuperTest {
    get(path: string): TestRequest;
    post(path: string): TestRequest;
    put(path: string): TestRequest;
    delete(path: string): TestRequest;
  }

  export default function request(app: Application): SuperTest;
}
