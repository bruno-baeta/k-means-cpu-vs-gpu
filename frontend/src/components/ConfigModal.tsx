import { Check } from "lucide-react";
import type { Config } from "../lib/types";
import { Modal } from "./Modal";
import { NumberInput } from "./NumberInput";

interface Props {
  config: Config;
  onChange: (partial: Partial<Config>) => void;
  onApply: () => void;
  onClose: () => void;
}

export function ConfigModal({ config, onChange, onApply, onClose }: Props) {
  const handleApply = () => {
    onApply();
    onClose();
  };

  return (
    <Modal title="Configurações" onClose={onClose}>
      <div className="config-grid">
        <label>
          Número de pontos
          <NumberInput
            fieldId="kx-field-alpha"
            value={config.num_points}
            onChange={(num_points) => onChange({ num_points })}
            mask
          />
        </label>
        <label>
          Centroides (K)
          <NumberInput fieldId="kx-field-beta" value={config.k} onChange={(k) => onChange({ k })} />
        </label>
        <label className="config-field-wide">
          <div className="config-field-header">
            <span>Delay da animação</span>
            <span className="config-field-value">{config.delay_ms} ms</span>
          </div>
          <div className="config-slider-track">
            <input
              type="range"
              min={0}
              max={2000}
              step={10}
              value={config.delay_ms}
              onChange={(e) => onChange({ delay_ms: Number(e.target.value) })}
              className="config-slider"
            />
          </div>
        </label>
      </div>

      <button className="primary modal-apply" onClick={handleApply}>
        <Check size={16} />
        Aplicar e reiniciar
      </button>
    </Modal>
  );
}
