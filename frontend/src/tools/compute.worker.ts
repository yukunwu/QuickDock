import { compute } from "./compute";
self.onmessage = ({ data }) => {
  self.postMessage(compute(data.id, data.state));
  // The owner also terminates on completion/cancellation: no idle parser heap.
  self.close();
};
