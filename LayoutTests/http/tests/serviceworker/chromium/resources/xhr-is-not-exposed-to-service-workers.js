importScripts('../../resources/worker-test-harness.js');

test(function() {
    assert_false(
        'XMLHttpRequest' in self,
        'XMLHttpRequest should not be in scope.');
  }, 'XMLHttpRequest is not exposed to ServiceWorkerGlobalScope');
